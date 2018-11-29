import omit from 'lodash.omit';
import { Logger, DataEntity } from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import {
    wrapError,
    AnyKafkaError,
    KafkaMessage,
    isOkayConsumeError,
    KafkaMessageMetadata
} from '../helpers';
import {
    TrackedOffsets,
    TopicPartition,
    ConsumerClientConfig,
    OffsetByPartition
} from './interfaces';

export default class ConsumerClient {
    private logger: Logger;
    private client: kafka.KafkaConsumer;
    private config: ConsumerClientConfig;
    private offsets: TrackedOffsets = {
        started: {},
        ended: {}
    };

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        this.logger = config.logger;
        this.client = client;
        this.config = config;
    }

    async commit() {
        const partitions = this._flushOffsets('ending');
        for (const partition of partitions) {
            this.client.commitSync(partition);
        }
    }

    committedPartitions(timeout = 1000): Promise<TopicPartition[]> {
        return new Promise((resolve, reject) => {
            this.client.committed(null, timeout, (err: AnyKafkaError, committed: TopicPartition[]) => {
                if (err) {
                    reject(wrapError('Failure to get committed offsets', err));
                    return;
                }

                resolve(committed);
            });
        });
    }

    async rollback() {
        const partitions = this._flushOffsets('started');

        const promises = partitions.map((par) => {
            return this.seek(par);
        });

        await Promise.all(promises);
    }

    seek(topic: { partition: number, offset: number }): Promise<void> {
        const { partition, offset } = topic;

        return new Promise((resolve, reject) => {
            this.client.seek({
                partition,
                offset,
                topic: this.config.topic
            }, 1000, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failue to seek', err));
                    return;
                }

                resolve();
            });
        });
    }

    topicPositions(): TopicPartition[] {
        return this.client.position(null);
    }

    async connect(): Promise<void> {
        if (this.client.isConnected()) {
            return Promise.resolve();
        }

        this._onReady();
        await this._connect();
    }

    async consume(max: { size: number, wait: number }): Promise<DataEntity[]> {
        const endAt = Date.now() + max.wait;
        let results: DataEntity[] = [];

        while (results.length < max.size && endAt > Date.now()) {
            const remaining = max.size - results.length;
            const remainingMs = endAt - Date.now();
            const timeout = remainingMs > 0 ? remainingMs : 0;

            this.client.setDefaultConsumeTimeout(timeout);

            const consumed = await this._consume(remaining);
            results = results.concat(consumed);
        }

        return results;
    }

    disconnect(): Promise<void> {
        if (!this.client.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.client.disconnect((err: AnyKafkaError) => {
                if (err) reject(wrapError('Failed to disconnect', err));
                else resolve();
            });
        });
    }

    private _consume(count: number): Promise<DataEntity[]> {
        return new Promise((resolve, reject) => {
            const results: DataEntity[] = [];

            this.client.consume(count, (err: AnyKafkaError, messages: KafkaMessage[]) => {
                if (err) {
                    if (!isOkayConsumeError(err)) {
                        reject(err);
                        return;
                    }
                    return;
                }

                this.logger.trace(`consumed ${messages.length} messages`);
                for (const message of messages) {
                    const entity = this._handleMessage(message);
                    if (entity != null) {
                        results.push(entity);
                    }
                }

                resolve(results);
            });
        });
    }

    private _handleMessage(message: KafkaMessage): DataEntity|null {
        this._trackOffsets(message);

        const metadata: KafkaMessageMetadata = omit(message, 'value');

        try {
            return DataEntity.fromBuffer(
                message.value,
                this.config.encoding,
                metadata
            );
        } catch (err) {
            const action = this.config.bad_record_action;
            if (action === 'log') {
                this.logger.error('Bad record', message.value.toString('utf8'), metadata);
                this.logger.error(err);
            } else if (action === 'throw') {
                throw err;
            }

            return null;
        }
    }

    private _flushOffsets(key: 'ending'|'started') {
        const offsets = Object.entries(this.offsets[key] as OffsetByPartition);

        const partitions: TopicPartition[] = [];
        for (const [partition, offset] of offsets) {
            partitions.push({
                partition: parseInt(partition, 10),
                topic: this.config.topic,
                offset,
            });
        }

        this.offsets.ended = {};
        this.offsets.started = {};
        return partitions;
    }

    private _trackOffsets({ partition, offset }: KafkaMessage) {
        // We want to track the first offset we receive so
        // we can rewind if there is an error.
        if (this.offsets.started[partition] == null) {
            this.logger.trace(`partition ${partition} started at offset ${offset}`);
            this.offsets.started[partition] = offset;
        }

        // We record the last offset we see for each
        // partition so that if the slice is successfull
        // they can be committed.
        this.offsets.ended[partition] = offset + 1;
    }

    private _connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.connect({}, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to connect', err));
                } else {
                    this.logger.debug('Connected to kafka as Consumer');
                    resolve();
                }
            });
        });
    }

    private _onReady() {
        this.client.on('ready', () => {
            this.logger.info('Consumer ready');
            this.client.subscribe([this.config.topic]);

            // for debug logs.
            this.client.on('event.log', (event) => {
                this.logger.info(event);
            });
        });
    }
}
