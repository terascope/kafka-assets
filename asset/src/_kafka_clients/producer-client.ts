import kafka from 'node-rdkafka';
import { ProduceMessage, ProducerClientConfig } from './interfaces.js';
import { wrapError, AnyKafkaError } from '../_kafka_helpers/index.js';
import BaseClient from './base-client.js';

/**
 * A Kafka Producer Client that only works with a single topic.
 * This client has improved error handling, with retry support,
 * and wraps the API calls with Promises.
*/
export default class ProducerClient extends BaseClient<kafka.Producer> {
    // one minute
    flushTimeout = 60000;

    private readonly _maxBufferMsgLength: number;
    private readonly _maxBufferKilobyteSize: number;
    private _hasClientEvents = false;
    private _bytesProduced = 0;

    constructor(client: kafka.Producer, config: ProducerClientConfig) {
        super(client, config.topic, config.logger);
        this._maxBufferMsgLength = config.maxBufferLength;
        this._maxBufferKilobyteSize = config.maxBufferKilobyteSize;
    }

    /**
     * Connect to kafka
    */
    async connect(): Promise<void> {
        this._clientEvents();
        await this._try(() => this._connect(), 'connect');
    }

    /**
     * Query for metadata on a topic. Used for dynamic topic creation
     * @param topic - topic to query metadata for
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

    /**
     * Produce messages and flush after the queue is full
     *
     * @param messages - an array of data or an array of pre-built kafka messages
     * @param [map] - a function to format a message for kafka
     *             (used to avoid having to make over the data multiple times)
    */
    async produce(messages: ProduceMessage[]): Promise<void>;
    async produce<T>(messages: T[], map: (msg: T) => ProduceMessage): Promise<void>;
    async produce(messages: any[], map?: (msg: any) => ProduceMessage): Promise<void> {
        let error: kafka.LibrdKafkaError | null = null;

        const off = this._once('client:error', (err) => {
            if (!err) return;
            /* istanbul ignore next */
            error = wrapError('Client error while producing', err);
        });

        const total = messages.length;
        const endOfSliceIndex = (total - 1);
        const endofBufferIndex = (this._maxBufferMsgLength - 1);
        // This is a counter that will track the bytes written in the current batch
        let currentBatchSizeInBytes = 0;
        const maxQueueByteSize = this._maxBufferKilobyteSize * 1024;
        if (this._maxBufferMsgLength > 0) {
            this._logger.debug(`Kafka producing ${total} messages in ${Math.floor(total / this._maxBufferMsgLength)} batches...`);
        } else {
            this._logger.debug(`Kafka producing ${total} messages in 1 batch...`);
        }

        try {
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

                    await this._try(() => this._flush(), 'produce', 0);
                    currentBatchSizeInBytes = messageByteSize;
                }

                this._client.produce(
                    message.topic || this._topic,
                    // This is the partition. There may be use cases where
                    // we'll need to control this.
                    null,
                    message.data,
                    message.key,
                    message.timestamp
                );

                // flush the messages at the end of each slice
                if (i === endOfSliceIndex) {
                    this._logger.debug(
                        `End of message slice reached: Flushing the queue after processing ${total} messages. `
                    );
                    await this._try(() => this._flush(), 'produce', 0);
                    currentBatchSizeInBytes = 0; // Reset the batch size counter
                /*
                *    Flush the queue as the message buffer is reaching its size limit,
                *    to avoid overflow. If set to 0, ignore flush completely
                */
                } else if (
                    this._maxBufferMsgLength > 0
                    && i % this._maxBufferMsgLength === endofBufferIndex
                ) {
                    this._logger.debug(
                        `Kafka producer max_buffer_size of ${this._maxBufferMsgLength} has been met, flushing queue to start new batch...`
                    );
                    await this._try(() => this._flush(), 'produce', 0);
                    currentBatchSizeInBytes = 0;
                }
            }
        } finally {
            off();
            /* istanbul ignore next */
            if (error) {
                this._logger.error(error);
            }
        }
    }

    /**
     * A promisified version of "flush",
     * uses `this.flushTimeout` as the as the timeout
    */
    private _flush(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._client.flush(this.flushTimeout, (err: AnyKafkaError) => {
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

        // for client event error logs.
        this._client.on('error' as any, this._logOrEmit('client:error'));

        // for event error logs.
        this._client.on('event.error', this._logOrEmit('client:error'));
    }

    /**
     * Get the number of bytes producer has produced
    */
    async getBytesProduced() {
        return this._bytesProduced;
    }
}
