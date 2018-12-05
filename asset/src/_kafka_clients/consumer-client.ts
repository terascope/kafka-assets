
import * as kafka from 'node-rdkafka';
import {
    wrapError,
    AnyKafkaError,
    KafkaMessage,
    isOkayError,
} from '../_kafka_helpers';
import BaseClient from './base-client';
import {
    TrackedOffsets,
    TopicPartition,
    ConsumerClientConfig,
    BadRecordAction,
} from './interfaces';
import {
    ERR__ASSIGN_PARTITIONS,
    ERR__REVOKE_PARTITIONS,
} from '../_kafka_helpers/error-codes';

export default class ConsumerClient extends BaseClient {
    private _client: kafka.KafkaConsumer;
    private _topic: string;
    private _badRecordAction: BadRecordAction;
    private _rebalancing = true;
    private _offsets: TrackedOffsets = {
        started: {},
        ended: {}
    };

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        super(config.logger);
        this._client = client;
        this._topic = config.topic;
        this._badRecordAction = config.bad_record_action;
    }

    async commit() {
        await this._checkState();

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

    async rollback() {
        await this._checkState();

        const partitions = this._flushOffsets('started');

        this._logger.warn('rolling back partitions', partitions);

        const promises = partitions.map((par) => {
            return this.seek(par);
        });

        await Promise.all(promises);
    }

    async seek(topic: { partition: number, offset: number }): Promise<void> {
        await this._checkState();

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

    async topicPositions(): Promise<TopicPartition[]> {
        await this._checkState();

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

        this._clientEvents();
        await this._connect();
    }

    async consume<T>(map: (msg: KafkaMessage) => T, max: { size: number, wait: number }): Promise<T[]> {
        await this._checkState();

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
        if (this._client.isConnected()) {
            await new Promise((resolve, reject) => {
                const off = this._once('client:disconnect', (err) => {
                    if (err) {
                        reject(err);
                    }
                });

                this._client.disconnect((err: AnyKafkaError) => {
                    off();
                    if (err) reject(wrapError('Failed to disconnect', err));
                    else resolve();
                });
            });
        }

        this._client.removeAllListeners();
        super.close();
    }

    private _consume<T>(count: number, map: (msg: KafkaMessage) => T): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const results: T[] = [];

            const handleError = (_err: AnyKafkaError) => {
                const err = wrapError(`Failure to consume ${count} messages`, _err);
                if (!isOkayError(_err, 'consume')) {
                    reject(err);
                } else {
                    this._logger.warn('got recoverable error when consuming', err);
                    resolve([]);
                }
                return;
            };

            const off = this._once('client:error', (err) => {
                if (err) {
                    handleError(err);
                }
            });

            this._client.consume(count, (err: AnyKafkaError, messages: KafkaMessage[]) => {
                off();

                if (err) {
                    handleError(err);
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
        return new Promise((resolve, reject) => {
            const off = this._once('connect:error', (err) => {
                if (err) {
                    reject(wrapError('Connect error', err));
                }
            });

            this._client.connect({}, (err: AnyKafkaError) => {
                off();
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
            this._logOrEmit('client:error', err);
        });

        this._client.on('ready', () => {
            this._logger.info('kafka consumer is ready');
            this._client.subscribe([this._topic]);
            this._rebalancing = false;
            this._events.emit('client:ready');
        });

        // for debug logs.
        this._client.on('event.log', (msg) => {
            this._logger.info(msg);
        });

        // for event error logs.
        this._client.on('event.error', (err) => {
            this._logOrEmit('client:error', err);
        });

        this._client.on('disconnected', (msg) => {
            this._logOrEmit('client:disconnected', msg);
        });

        let rebalanceTimeout: NodeJS.Timeout;

        // @ts-ignore because the type definition don't work right
        this._client.on('rebalance', (err, assignment) => {
            if (this._closed) return;

            this._logger.debug('kafka consumer rebalance', err && err.message, assignment);

            if (err && (err.code[ERR__ASSIGN_PARTITIONS] || err.code[ERR__REVOKE_PARTITIONS])) {
                this._rebalancing = true;
                this._events.emit('rebalance:start', assignment);

                clearTimeout(rebalanceTimeout);
                rebalanceTimeout = setTimeout(() => {
                    this._rebalancing = false;
                    this._events.emit('rebalance:end');
                // this timeout should be configurable?
                }, 100);
            }
        });

        // @ts-ignore because the event doesn't exist in the typedefinitions
        this._client.on('rebalance.error', (err) => {
            this._logOrEmit('rebalance:end', err);
        });

        this._client.on('unsubscribed', (...args: any[]) => {
            this._logOrEmit('client:unsubscribed', ...args);
        });

        this._client.on('connection.failure', (...args: any[]) => {
            this._logOrEmit('connect:error', ...args);
        });
    }

    private async _checkState(): Promise<void> {
        if (this._closed) {
            throw new Error('Client is closed');
        }

        if (!this._client.isConnected()) {
            this._logger.debug('waiting for client to connect');
            await this.connect();
        }

        if (this._rebalancing) {
            this._logger.debug('waiting for rebalance');
            await new Promise((resolve, reject) => {
                const eventOff = this._once('rebalance:end', (err) => {
                    timeoutOff();
                    if (err) reject(err);
                    else resolve();
                });
                const timeoutOff = this._timeout((err) => {
                    eventOff();
                    if (err) reject(err);
                    else resolve();
                }, 30 * 60 * 1000);
            });
        }
    }
}
