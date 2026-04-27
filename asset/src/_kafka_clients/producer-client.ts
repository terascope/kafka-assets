import {
    IAdminClient, LibrdKafkaError, Producer, TopicDescription
} from '@confluentinc/kafka-javascript';
import { pRetry } from '@terascope/core-utils';
import {
    DeliveryReportConfig, DeliveryReportOpaque, DeliveryReportBatchStats,
    DeliveryReportStats, ProduceMessage, ProducerClientConfig
} from './interfaces.js';
import { wrapError, AnyKafkaError } from '../_kafka_helpers/index.js';
import BaseClient from './base-client.js';

/**
 * A Kafka Producer Client that only works with a single topic.
 * This client has improved error handling, with retry support,
 * and wraps the API calls with Promises.
*/
export default class ProducerClient extends BaseClient<Producer> {
    // one minute
    flushTimeout = 60000;

    private readonly _maxBufferMsgLength: number;
    private readonly _maxBufferKilobyteSize: number;
    private readonly _queueBackpressureStrategy: 'threshold_flush' | 'retry_on_full';
    private _hasClientEvents = false;
    private _bytesProduced = 0;
    private _deliveryErrorCount = 0;
    private adminClient: IAdminClient;
    private deliveryReportConfig: DeliveryReportConfig | undefined;
    deliveryReportStats: DeliveryReportStats = {};
    slice_num: number = 0;

    constructor(client: Producer, adminClient: IAdminClient, config: ProducerClientConfig) {
        super(client, config.topic, config.logger);
        this._maxBufferMsgLength = config.maxBufferLength;
        this._maxBufferKilobyteSize = config.maxBufferKilobyteSize;
        this._queueBackpressureStrategy = config.queue_backpressure_strategy ?? 'threshold_flush';
        this.adminClient = adminClient;
        this.deliveryReportConfig = config.deliveryReportConfig;
    }

    /**
     * Connect to kafka
    */
    async connect(): Promise<void> {
        this._clientEvents();
        await this._try(() => this._connect(), 'connect');
    }

    /**
     * Query for metadata on a topic. If the topic does not exist it will be created.
     * @param topic - topic to query metadata for.
    */
    async getMetadata(topic: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._client.getMetadata({ topic }, (err: AnyKafkaError) => {
                /* istanbul ignore if */
                if (err) reject(wrapError(`Failed to get topic metadata for topic "${topic}"`, err));
                else resolve();
            });
        });
    }

    async doesTopicExist(topic: string) {
        const topicDescriptions = await new Promise<TopicDescription[]>((resolve, reject) => {
            this.adminClient.describeTopics(
                [topic],
                undefined,
                (err: AnyKafkaError, data: TopicDescription[]) => {
                    if (err) {
                        reject(wrapError(`Failed to get topic metadata for topic "${topic}"`, err));
                    } else {
                        resolve(data);
                    }
                }
            );
        });

        const foundTopic = topicDescriptions.find(
            // if partitions is an empty array then the topic does not exist
            (obj: TopicDescription) => obj.name === topic && obj.partitions.length > 0
        );

        return !!foundTopic;
    }

    /**
     * Dispatches to produceV1 or produceV2 based on the queue_backpressure_strategy
     * set at construction time.
     *
     * @param messages - an array of data or an array of pre-built kafka messages
     * @param batchNumber - a number representing the number of batches (slices for
     *                      teraslice jobs) since the client was created.
     * @param [map] - a function to format a message for kafka
     *                (used to avoid having to make over the data multiple times)
    */
    async produce(messages: ProduceMessage[], batchNumber: number): Promise<void>;
    async produce<T>(
        messages: T[],
        batchNumber: number,
        map: (msg: T) => ProduceMessage,
    ): Promise<void>;
    async produce(
        messages: any[],
        batchNumber: number,
        map?: (msg: any) => ProduceMessage,
    ): Promise<void> {
        if (this._queueBackpressureStrategy === 'retry_on_full') {
            return map != null
                ? this.produceV2(messages, batchNumber, map)
                : this.produceV2(messages, batchNumber);
        }
        return map != null
            ? this.produceV1(messages, batchNumber, map)
            : this.produceV1(messages, batchNumber);
    }

    /**
     * Produce messages and flush after the queue is full (threshold_flush strategy).
     *
     * > **NOTE:** This is the `threshold_flush` implementation. When making changes here,
     * > ensure the same change is applied to {@link produceV2} if it also applies to the
     * > `retry_on_full` strategy, and vice-versa.
     *
     * @param messages - an array of data or an array of pre-built kafka messages
     * @param batchNumber - a number representing the number of batches (slices for
     *                      teraslice jobs) since the client was created.
     * @param [map] - a function to format a message for kafka
     *                (used to avoid having to make over the data multiple times)
    */
    async produceV1(messages: ProduceMessage[], batchNumber: number): Promise<void>;
    async produceV1<T>(
        messages: T[],
        batchNumber: number,
        map: (msg: T) => ProduceMessage,
    ): Promise<void>;
    async produceV1(
        messages: any[],
        batchNumber: number,
        map?: (msg: any) => ProduceMessage,
    ): Promise<void> {
        let clientError: LibrdKafkaError | null = null;
        let waitForAllReceived: Promise<void> | undefined;
        let allReceivedOff = () => {};

        const clientErrorOff = this._once('client:error', (err) => {
            if (!err) return;
            /* istanbul ignore next */
            clientError = wrapError('Client error while producing', err);
        });

        const total = messages.length;
        const endOfSliceIndex = (total - 1);
        const endOfBufferIndex = (this._maxBufferMsgLength - 1);
        // This is a counter that will track the bytes written in the current batch
        let currentBatchSizeInBytes = 0;
        const maxQueueByteSize = this._maxBufferKilobyteSize * 1024;
        if (this._maxBufferMsgLength > 0) {
            this._logger.debug(`Kafka producing ${total} messages in ${Math.floor(total / this._maxBufferMsgLength)} batches...`);
        } else {
            this._logger.debug(`Kafka producing ${total} messages in 1 batch...`);
        }

        try {
            // If only_error is true or there are no messages we will not gather batch stats
            if (this.deliveryReportConfig && !this.deliveryReportConfig?.only_error && total > 0) {
                this.deliveryReportStats[batchNumber] = {
                    received: 0,
                    errors: 0,
                    expected: total
                };
            }

            if (this.deliveryReportConfig?.wait && total > 0) {
                const waitTimeout = this.deliveryReportConfig.waitTimeout;
                /**
                 * When waiting for delivery reports, we want a delivery report error to immediately
                 * fail a slice, therefore we Promise.race() waitForAllReceived with any flush. If
                 * there are no delivery errors flush will win the race and we either keep producing
                 * or, if done producing, wait for all delivery reports to be received. If there is
                 * an error we immediately stop flushing and throw, causing the slice to fail and we
                 * retry the whole slice again.
                 */
                waitForAllReceived = new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error(`Delivery-report: waitTimeout exceeded for batch ${batchNumber}: ${waitTimeout}ms.`));
                    }, waitTimeout);

                    allReceivedOff = this._once(`delivery-report:batch:${batchNumber}`, (err, args) => {
                        clearTimeout(timer);
                        const [report, stats] = args;
                        if (err) {
                            reject(new Error(`Delivery-report: error received: ${JSON.stringify(report)},\n err ${err}`));
                        } else {
                            this._logger.debug(
                                `Delivery-report: all ${report?.opaque?.msgNumber} reports received for batchNumber ${batchNumber}. Stats: ${JSON.stringify(stats)}`
                            );
                            resolve();
                        }
                    });
                });

                /** Suppress floating rejection if delivery report error received
                 * before or between flush calls and before the final await after for-loop.
                 * The final await of waitForAllReceived will still throw the error.
                 */
                waitForAllReceived.catch(() => {});
            }
            // Send the messages, after each buffer size is complete
            // flush the messages
            for (let i = 0; i < total; i++) {
                const msg = messages[i];
                const message: ProduceMessage = (map == null) ? msg : map(msg);
                const messageByteSize = Buffer.byteLength(message.data);
                this._bytesProduced += messageByteSize;
                currentBatchSizeInBytes += messageByteSize;

                // If the current queue batch kb size gets full, do a flush.
                if (currentBatchSizeInBytes >= maxQueueByteSize) {
                    this._logger.warn(
                        `Kafka producer queue size exceeded limit: max_buffer_kbytes_size = ${this._maxBufferKilobyteSize} KB, `
                        + `Current batch size = ${currentBatchSizeInBytes / 1024} KB. Initiating queue flush to prevent overflow...`
                    );

                    const flushPromise = this._try(() => this._flush(), 'produce', 0);

                    // See comment for why race is used on waitForAllReceived above
                    await (waitForAllReceived
                        ? Promise.race([flushPromise, waitForAllReceived])
                        : flushPromise);

                    currentBatchSizeInBytes = messageByteSize;
                }

                this._client.produce(
                    message.topic || this._topic,
                    // This is the partition. There may be use cases where
                    // we'll need to control this.
                    null,
                    message.data,
                    message.key,
                    message.timestamp,
                    ...this.deliveryReportConfig ? [message.opaque] : []
                );

                // flush the messages at the end of each slice
                if (i === endOfSliceIndex) {
                    this._logger.debug(
                        `End of message slice reached: Flushing the queue after processing ${total} messages. `
                    );

                    const flushPromise = this._try(() => this._flush(), 'produce', 0);

                    // See comment for why race is used on waitForAllReceived above
                    await (waitForAllReceived
                        ? Promise.race([flushPromise, waitForAllReceived])
                        : flushPromise);

                    currentBatchSizeInBytes = 0; // Reset the batch size counter
                /*
                *    Flush the queue as the message buffer is reaching its size limit,
                *    to avoid overflow. If set to 0, ignore flush completely
                */
                } else if (
                    this._maxBufferMsgLength > 0
                    && i % this._maxBufferMsgLength === endOfBufferIndex
                ) {
                    this._logger.debug(
                        `Kafka producer max_buffer_size of ${this._maxBufferMsgLength} has been met, flushing queue to start new batch...`
                    );

                    const flushPromise = this._try(() => this._flush(), 'produce', 0);

                    // See comment for why race is used on waitForAllReceived above
                    await (waitForAllReceived
                        ? Promise.race([flushPromise, waitForAllReceived])
                        : flushPromise);

                    currentBatchSizeInBytes = 0;
                }
            }

            if (this.deliveryReportConfig?.wait) {
                await waitForAllReceived;
            }
        } finally {
            allReceivedOff();
            clientErrorOff();

            // cleanup stats if there was an error
            if (this.deliveryReportConfig?.wait) {
                delete this.deliveryReportStats[batchNumber];
            }

            /* istanbul ignore next */
            if (clientError) {
                this._logger.error(clientError);
            }
        }
    }

    /**
     * Produce messages using a retry-on-queue-full strategy. Each message is wrapped
     * in a pRetry that backs off and retries when librdkafka returns a "queue full"
     * error, then a single flush is issued at the end of the slice.
     *
     * > **NOTE:** This is the `retry_on_full` implementation. When making changes here,
     * > ensure the same change is applied to {@link produceV1} if it also applies to the
     * > `threshold_flush` strategy, and vice-versa.
     *
     * @param messages - an array of data or an array of pre-built kafka messages
     * @param batchNumber - a number representing the number of batches (slices for
     *                      teraslice jobs) since the client was created.
     * @param [map] - a function to format a message for kafka
     *                (used to avoid having to make over the data multiple times)
    */
    async produceV2(messages: ProduceMessage[], batchNumber: number): Promise<void>;
    async produceV2<T>(
        messages: T[],
        batchNumber: number,
        map: (msg: T) => ProduceMessage,
    ): Promise<void>;
    async produceV2(
        messages: any[],
        batchNumber: number,
        map?: (msg: any) => ProduceMessage,
    ): Promise<void> {
        let clientError: LibrdKafkaError | null = null;
        let waitForAllReceived: Promise<void> | undefined;
        let allReceivedOff = () => {};
        this.slice_num += 1;

        const clientErrorOff = this._once('client:error', (err) => {
            if (!err) return;
            /* istanbul ignore next */
            clientError = wrapError('Client error while producing', err);
        });

        const total = messages.length;
        const endOfSliceIndex = (total - 1);

        this._logger.debug(`Kafka producing ${total} messages...`);

        try {
            // If only_error is true or there are no messages we will not gather batch stats
            if (this.deliveryReportConfig && !this.deliveryReportConfig?.only_error && total > 0) {
                this.deliveryReportStats[batchNumber] = {
                    received: 0,
                    errors: 0,
                    expected: total
                };
            }

            if (this.deliveryReportConfig?.wait && total > 0) {
                const waitTimeout = this.deliveryReportConfig.waitTimeout;
                /**
                 * When waiting for delivery reports, we want a delivery report error to immediately
                 * fail a slice, therefore we Promise.race() waitForAllReceived with any flush. If
                 * there are no delivery errors flush will win the race and we either keep producing
                 * or, if done producing, wait for all delivery reports to be received. If there is
                 * an error we immediately stop flushing and throw, causing the slice to fail and we
                 * retry the whole slice again.
                 */
                waitForAllReceived = new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error(`Delivery-report: waitTimeout exceeded for batch ${batchNumber}: ${waitTimeout}ms.`));
                    }, waitTimeout);

                    allReceivedOff = this._once(`delivery-report:batch:${batchNumber}`, (err, args) => {
                        clearTimeout(timer);
                        const [report, stats] = args;
                        if (err) {
                            reject(new Error(`Delivery-report: error received: ${JSON.stringify(report)},\n err ${err}`));
                        } else {
                            this._logger.debug(
                                `Delivery-report: all ${report?.opaque?.msgNumber} reports received for batchNumber ${batchNumber}. Stats: ${JSON.stringify(stats)}`
                            );
                            resolve();
                        }
                    });
                });

                /** Suppress floating rejection if delivery report error received
                 * before or between flush calls and before the final await after for-loop.
                 * The final await of waitForAllReceived will still throw the error.
                 */
                waitForAllReceived.catch(() => {});
            }

            // Keeps track of all produce attempts per slice
            let totalProduceCalls = 0;
            let totalFailedCalls = 0;
            let totalSuccessfulCalls = 0;
            for (let i = 0; i < total; i++) {
                const msg = messages[i];
                const message: ProduceMessage = (map == null) ? msg : map(msg);

                this._bytesProduced += Buffer.byteLength(message.data);

                await pRetry(async () => {
                    totalProduceCalls += 1;
                    try {
                        this._client.produce(
                            message.topic || this._topic,
                            // This is the partition. There may be use cases where
                            // we'll need to control this.
                            null,
                            message.data,
                            message.key,
                            message.timestamp,
                            ...this.deliveryReportConfig ? [message.opaque] : []
                        );
                        totalSuccessfulCalls += 1;
                    } catch (err) {
                        totalFailedCalls += 1;
                        throw err;
                    }
                }, {
                    retries: Infinity,
                    backoff: 2,
                    matches: [/queue full/i]
                });

                // Flush at the end of each slice to ensure all buffered messages are sent.
                if (i === endOfSliceIndex) {
                    this._logger.debug(
                        `End of message slice reached: Flushing the queue after processing ${total} messages.`
                    );
                    if (totalFailedCalls > 0) {
                        this._logger.warn(`Writes to the Kafka producer queue were retried ${totalFailedCalls} times for slice ${this.slice_num}`);
                    }
                    this._logger.debug(`Produce calls totals for slice number ${this.slice_num}: totalProduceCalls=${totalProduceCalls}, totalFailedCalls=${totalFailedCalls}, totalSuccessfulCalls=${totalSuccessfulCalls}`);
                    const flushPromise = this._try(() => this._flush(), 'produce', 30);
                    await (waitForAllReceived
                        ? Promise.race([flushPromise, waitForAllReceived])
                        : flushPromise);
                }
            }

            if (this.deliveryReportConfig?.wait) {
                await waitForAllReceived;
            }
        } finally {
            allReceivedOff();
            clientErrorOff();

            // cleanup stats if there was an error
            if (this.deliveryReportConfig?.wait) {
                delete this.deliveryReportStats[batchNumber];
            }

            /* istanbul ignore next */
            if (clientError) {
                this._logger.error(clientError);
            }
        }
    }

    /**
     * A promisified version of "flush",
     * uses `this.flushTimeout` as the timeout
    */
    private _flush(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._client.flush(this.flushTimeout, (err: AnyKafkaError) => {
                // an error here means the flush failed. Individual messages can
                // fail to be delivered and the flush still succeeds
                /* istanbul ignore if */
                if (err) reject(wrapError('Failed to flush messages', err));
                else resolve();
            });
        });
    }

    /**
     * Add event listeners to the kafka client.
     * This is only done once to avoid potential event message
     * loss when removing and adding listeners
    */
    private _clientEvents() {
        if (this._hasClientEvents) return;
        this._hasClientEvents = true;

        // for client error logs.
        this._client.on('error' as any, this._logOrEmit('client:error'));

        // for client event error logs.
        this._client.on('event.error', this._logOrEmit('client:error'));

        /* istanbul ignore next */
        this._client.on('event.log', (msg) => {
            this._logger.info(msg);
        });

        // message delivery statistics
        if (this.deliveryReportConfig) {
            this._client.on('delivery-report', (err, report) => {
                const { batchNumber } = report.opaque as DeliveryReportOpaque;
                const currBatchStats: DeliveryReportBatchStats | undefined
                    = this.deliveryReportStats[batchNumber];
                const errLogMsg = `Delivery-report: error received: ${JSON.stringify(report)}`;

                if (currBatchStats && this.deliveryReportConfig) {
                    const { on_error, wait } = this.deliveryReportConfig;
                    currBatchStats.received++;

                    if (err) {
                        this._deliveryErrorCount++;
                        currBatchStats.errors++;

                        if (on_error !== 'ignore') {
                            on_error === 'throw'
                                ? this._events.emit(`delivery-report:batch:${batchNumber}`, err, report, currBatchStats)
                                : this._logger.error(err, errLogMsg);
                        }
                    }

                    if (currBatchStats.received === currBatchStats.expected) {
                        wait
                            ? this._events.emit(`delivery-report:batch:${batchNumber}`, report, currBatchStats)
                            : this._logger.debug(`Delivery-report: all ${currBatchStats.received} reports received for batch ${batchNumber}: ${JSON.stringify(currBatchStats)}`);
                        delete this.deliveryReportStats[batchNumber];
                    }
                } else {
                    // currBatchStats will not exist when only_error is true. on_error must be log.
                    if (err) {
                        this._logger.error(err, errLogMsg);
                    }
                }
            });
        }
    }

    /**
     * Get the number of bytes producer has produced
    */
    async getBytesProduced() {
        return this._bytesProduced;
    }

    /**
     * Get the number of messages that resulted in delivery report errors
    */
    async getDeliveryErrorCount() {
        return this._deliveryErrorCount;
    }
}
