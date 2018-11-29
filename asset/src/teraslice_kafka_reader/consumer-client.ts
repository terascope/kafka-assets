import { EventEmitter } from 'events';
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
} from './interfaces';

export default class ConsumerClient {
    private _logger: Logger;
    private _client: kafka.KafkaConsumer;
    private _config: ConsumerClientConfig;
    private _events = new EventEmitter();
    private _offsets: TrackedOffsets = {
        started: {},
        ended: {}
    };

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        this._logger = config.logger;
        this._client = client;
        this._config = config;
    }

    async commit() {
        const partitions = this._flushOffsets('ended');
        for (const partition of partitions) {
            this._client.commitSync(partition);
        }
    }

    committedPartitions(timeout = 1000): Promise<TopicPartition[]> {
        return new Promise((resolve, reject) => {
            this._client.committed(null, timeout, (err: AnyKafkaError, committed: TopicPartition[]) => {
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

        this._logger.warn('rolling back partitions', partitions);

        const promises = partitions.map((par) => {
            return this.seek(par);
        });

        await Promise.all(promises);
    }

    seek(topic: { partition: number, offset: number }): Promise<void> {
        const { partition, offset } = topic;

        return new Promise((resolve, reject) => {
            this._client.seek({
                partition,
                offset,
                topic: this._config.topic
            }, 1000, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failure to seek', err));
                    return;
                }

                this._logger.debug(`seeked partition ${partition} to offset ${offset}`);
                this._offsets.started[partition] = offset;
                delete this._offsets.ended[partition];

                resolve();
            });
        });
    }

    topicPositions(): TopicPartition[] {
        return this._client.position(null);
    }

    async connect(): Promise<void> {
        if (this._client.isConnected()) {
            return Promise.resolve();
        }

        await this._connect();
    }

    async consume(max: { size: number, wait: number }): Promise<DataEntity[]> {
        const endAt = Date.now() + max.wait;
        let results: DataEntity[] = [];

        while (results.length < max.size && endAt > Date.now()) {
            const remaining = max.size - results.length;
            const remainingMs = endAt - Date.now();
            const timeout = remainingMs > 0 ? remainingMs : 0;

            this._client.setDefaultConsumeTimeout(timeout);

            const consumed = await this._consume(remaining);
            results = results.concat(consumed);
        }

        return results;
    }

    disconnect(): Promise<void> {
        if (!this._client.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this._client.disconnect((err: AnyKafkaError) => {
                if (err) reject(wrapError('Failed to disconnect', err));
                else resolve();
            });
        });
    }

    private _consume(count: number): Promise<DataEntity[]> {
        return new Promise((resolve, reject) => {
            const results: DataEntity[] = [];

            this._client.consume(count, (err: AnyKafkaError, messages: KafkaMessage[]) => {
                if (err) {
                    if (!isOkayConsumeError(err)) {
                        reject(err);
                        return;
                    }
                    return;
                }

                this._logger.trace(`consumed ${messages.length} messages`);
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
                this._config.encoding,
                metadata
            );
        } catch (err) {
            const action = this._config.bad_record_action;
            if (action === 'log') {
                this._logger.error('Bad record', message.value.toString('utf8'), metadata, err);
            } else if (action === 'throw') {
                throw err;
            }

            return null;
        }
    }

    private _flushOffsets(key: keyof TrackedOffsets) {
        const partitions: TopicPartition[] = [];
        for (const partition of Object.keys(this._offsets[key])) {
            const offset = this._offsets[key][partition];

            partitions.push({
                partition: parseInt(partition, 10),
                topic: this._config.topic,
                offset,
            });
        }

        this._offsets.ended = {};
        this._offsets.started = {};
        return partitions;
    }

    private _trackOffsets({ partition, offset }: KafkaMessage) {
        // We want to track the first offset we receive so
        // we can rewind if there is an error.
        if (this._offsets.started[partition] == null) {
            this._logger.trace(`partition ${partition} started at offset ${offset}`);
            this._offsets.started[partition] = offset;
        }

        // We record the last offset we see for each
        // partition so that if the slice is successfull
        // they can be committed.
        this._offsets.ended[partition] = offset + 1;
    }

    private _connect(): Promise<void> {
        this._clientEvents();

        return new Promise((resolve, reject) => {
            this._client.connect({}, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to connect', err));
                } else {
                    this._logger.debug('Connected to kafka as Consumer');
                    resolve();
                }
            });
        });
    }

    private _clientEvents() {
        this._client.on('error', (err) => {
            if (this._events.listenerCount('client:error')) {
                this._events.emit('client:error', err);
            } else {
                this._logger.error('kafka client error', err);
            }
        });

        this._client.on('ready', () => {
            this._logger.info('Consumer ready');
            this._client.subscribe([this._config.topic]);
        });

        // for debug logs.
        this._client.on('event.log', (event) => {
            this._logger.info(event);
        });

        this._client.on('disconnected', (msg) => {
            this._logger.warn('kafka consumer disconnected', msg);
        });

        this._client.on('exit', (msg) => {
            this._logger.warn('kafka consumer exited', msg);
        });

        this._client.on('end', (msg) => {
            this._logger.debug('kafka consumer ended', msg);
        });

        this._client.on('close', (msg) => {
            this._logger.debug('kafka consumer closed', msg);
        });

        this._client.on('rebalance', (msg) => {
            this._logger.debug('kafka consumer rebalance', msg);
        });

        this._client.on('unsubscribed', (msg) => {
            this._logger.debug('kafka consumer unsubscribed', msg);
        });

        this._client.on('connection.failure', (msg) => {
            this._logger.warn('kafka consumer connection failure', msg);
        });
    }
}
