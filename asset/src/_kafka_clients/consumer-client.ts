
import { Logger } from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import {
    wrapError,
    AnyKafkaError,
    KafkaMessage,
    isOkayError,
    isError,
} from '../_kafka_helpers';
import BaseClient from './base-client';
import {
    TrackedOffsets,
    TopicPartition,
    ConsumerClientConfig,
    BadRecordAction,
} from './interfaces';

export default class ConsumerClient extends BaseClient {
    private _logger: Logger;
    private _client: kafka.KafkaConsumer;
    private _topic: string;
    private _badRecordAction: BadRecordAction;
    private _offsets: TrackedOffsets = {
        started: {},
        ended: {}
    };

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        super();
        this._logger = config.logger;
        this._client = client;
        this._topic = config.topic;
        this._badRecordAction = config.bad_record_action;
    }

    async commit() {
        const offsets = this._flushOffsets('ended');

        for (const offset of offsets) {
            try {
                this._client.commitSync(offset);
            } catch (_err) {
                const { partition } = offset;
                const err = wrapError(`Failure to commit to ${partition}`, _err);

                if (!isOkayError(_err, 'commit')) {
                    throw err;
                } else {
                    this._logger.warn('got recoverable error when committing', err);
                }
            }
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
                topic: this._topic
            }, 1000, (err: AnyKafkaError) => {
                if (err) {
                    const message = `Failure to seek partition ${partition} to offset ${offset}`;
                    reject(wrapError(message, err));
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
        try {
            return this._client.position(null);
        } catch (err) {
            throw wrapError('Failed to get topic partitions', err);
        }
    }

    async connect(): Promise<void> {
        if (this._client.isConnected()) {
            return;
        }

        await this._connect();
    }

    async consume<T>(map: (msg: KafkaMessage) => T, max: { size: number, wait: number }): Promise<T[]> {
        const endAt = Date.now() + max.wait;
        let results: T[] = [];

        while (results.length < max.size && endAt > Date.now()) {
            const remaining = max.size - results.length;
            const remainingMs = endAt - Date.now();
            const timeout = remainingMs > 0 ? remainingMs : 0;

            this._client.setDefaultConsumeTimeout(timeout);

            const consumed = await this._consume(remaining, map);
            results = results.concat(consumed);
        }

        return results;
    }

    async disconnect(): Promise<void> {
        if (!this._client.isConnected()) {
            return;
        }

        const onDisconnect = this._onceWithTimeout('client:disconnect', true);

        await new Promise((resolve, reject) => {
            this._client.disconnect((err: AnyKafkaError) => {
                if (err) reject(wrapError('Failed to disconnect', err));
                else resolve();
            });
        });

        await onDisconnect;
    }

    private _consume<T>(count: number, map: (msg: KafkaMessage) => T): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const results: T[] = [];

            this._client.consume(count, (_err: AnyKafkaError, messages: KafkaMessage[]) => {
                if (_err) {
                    const err = wrapError(`Failure to consume ${count} messages`, _err);
                    if (!isOkayError(_err, 'consume')) {
                        reject(err);
                    } else {
                        this._logger.warn('got recoverable error when consuming', err);
                        resolve([]);
                    }
                    return;
                }

                this._logger.trace(`consumed ${messages.length} messages`);
                for (const message of messages) {
                    const entity = this._handleMessage(message, map);
                    if (entity != null) {
                        results.push(entity);
                    }
                }

                resolve(results);
            });
        });
    }

    private _handleMessage<T>(message: KafkaMessage, map: (msg: KafkaMessage) => T): T|null {
        this._trackOffsets(message);

        try {
            return map(message);
        } catch (err) {
            if (this._badRecordAction === 'log') {
                this._logger.error('Bad record', message.value.toString('utf8'), err);
            } else if (this._badRecordAction === 'throw') {
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
                topic: this._topic,
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
            this._logger.info('kafka consumer is ready');
            this._client.subscribe([this._topic]);
        });

        // for debug logs.
        this._client.on('event.log', (event) => {
            this._logger.info(event);
        });

        this._client.on('disconnected', (msg) => {
            if (isError(msg)) {
                this._logger.warn('kafka consumer disconnected with error', msg);
            } else {
                this._logger.debug('kafka consumer disconnected');
            }
            this._events.emit('client:disconnected', msg);
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

        // @ts-ignore because the type definition don't work right
        this._client.on('rebalance', (err, assignment) => {
            this._logger.debug('kafka consumer rebalance', { err, assignment });
        });

        // @ts-ignore because the event doesn't exist in the typedefinitions
        this._client.on('rebalance.error', (err) => {
            this._logger.warn('kafka consumer rebalance error', err);
        });

        this._client.on('unsubscribed', (msg) => {
            this._logger.debug('kafka consumer unsubscribed', msg);
        });

        this._client.on('connection.failure', (msg) => {
            this._logger.warn('kafka consumer connection failure', msg);
        });
    }
}
