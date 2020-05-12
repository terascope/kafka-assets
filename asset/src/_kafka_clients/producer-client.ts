import * as kafka from 'node-rdkafka';
import { ProduceMessage, ProducerClientConfig } from './interfaces';
import { wrapError, AnyKafkaError } from '../_kafka_helpers';
import BaseClient from './base-client';

/**
 * A Kafka Producer Client that only works with a single topic.
 * This client has improved error handling, with retry support,
 * and wraps the API calls with Promises.
*/
export default class ProducerClient extends BaseClient<kafka.Producer> {
    // one minute
    flushTimeout = 60000;

    private readonly _bufferSize: number;
    private _hasClientEvents = false;

    constructor(client: kafka.Producer, config: ProducerClientConfig) {
        super(client, config.topic, config.logger);
        this._bufferSize = config.bufferSize;
    }

    /**
     * Connect to kafka
    */
    async connect(): Promise<void> {
        this._clientEvents();
        await this._try(() => this._connect(), 'connect');
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
        let error: kafka.LibrdKafkaError|null = null;

        const off = this._once('client:error', (err) => {
            if (!err) return;
            /* istanbul ignore next */
            error = wrapError('Client error while producing', err);
        });

        const total = messages.length;
        const endOfBatchIndex = (total - 1);
        const endofBufferIndex = (this._bufferSize - 1);
        this._logger.debug(`producing ${total} messages in batches ${Math.floor(total / this._bufferSize)}...`);

        try {
            // Send the messages, after each buffer size is complete
            // flush the messages
            for (let i = 0; i < total; i++) {
                const msg = messages[i];
                const message: ProduceMessage = (map == null) ? msg : map(msg);

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
                if (i === endOfBatchIndex) {
                    await this._try(() => this._flush(), 'produce', 0);
                // OR at that the first message
                } else if (i % this._bufferSize === endofBufferIndex) {
                    await this._try(() => this._flush(), 'produce', 0);
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
        return new Promise((resolve, reject) => {
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
}
