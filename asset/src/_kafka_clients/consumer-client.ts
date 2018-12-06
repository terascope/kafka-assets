
import * as kafka from 'node-rdkafka';
import {
    wrapError,
    AnyKafkaError,
    KafkaMessage,
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
    private _hasClientEvents = false;
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

        const promises = this._flushOffsets('ended')
            .map((offset) => {
                return this._try(() => {
                    return this._client.commitSync(offset);
                }, 'commit');
            });

        await promises;
    }

    async rollback() {
        await this._checkState();

        const partitions = this._flushOffsets('started');

        this._logger.warn('rolling back partitions', partitions);

        const promises = partitions.map((par) => {
            return this._try(() => this._seek(par));
        });

        await Promise.all(promises);
    }

    async seek(topic: { partition: number, offset: number }): Promise<void> {
        await this._checkState();

        await this._try(() => this._seek(topic));
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
        if (this._client.isConnected()) return;

        this._clientEvents();

        await this._tryWithEvent('connect:error', () => this._connect(), 'connect');
        this._logger.debug('Connected to kafka');
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
                this._client.disconnect((err: AnyKafkaError) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        this._client.removeAllListeners();
        super.close();
    }

    private async _consume<T>(count: number, map: (msg: KafkaMessage) => T): Promise<T[]> {
        const results: T[] = [];

        const messages = await this._tryWithEvent('client:error', async () => {
            return this._consumeMessages(count);
        }, 'consume', 0);

        if (messages == null) return [];

        this._logger.trace(`consumed ${messages.length} messages`);

        for (const message of messages) {
            const entity = this._handleMessage(message, map);
            if (entity != null) {
                results.push(entity);
            }
        }

        return results;
    }

    private _consumeMessages(count: number): Promise<KafkaMessage[]> {
        return new Promise((resolve, reject) => {
            this._client.consume(count, (err: AnyKafkaError, messages: KafkaMessage[]) => {
                if (err) reject(err);
                else resolve(messages);
            });
        });
    }

    private _handleMessage<T>(message: KafkaMessage, map: (msg: KafkaMessage) => T): T|null {
        this._trackOffsets(message);

        try {
            return map(message);
        } catch (err) {
            if (this._badRecordAction === 'log') {
                this._logger.error('Bad record', message.value.toString('utf8'));
                this._logger.error(err);
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
            this._client.connect({}, (err: AnyKafkaError) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private async _seek(topic: { partition: number, offset: number }): Promise<void> {
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

    private _clientEvents() {
        if (this._hasClientEvents) return;
        this._hasClientEvents = true;

        this._client.on('error', this._logOrEmit('client:error'));

        this._client.on('ready', () => {
            this._logger.info('kafka consumer is ready');
            this._client.subscribe([this._topic]);
            this._rebalancing = false;
            this._events.emit('client:ready');
        });

        /* istanbul ignore next */
        // for debug logs.
        this._client.on('event.log', (msg) => {
            this._logger.info(msg);
        });

        // for event error logs.
        this._client.on('event.error', this._logOrEmit('client:error'));

        this._client.on('disconnected', this._logOrEmit('client:disconnected'));

        let rebalanceTimeout: NodeJS.Timeout;

        // @ts-ignore because the type definition don't work right
        this._client.on('rebalance', (err, assignment) => {
            if (this._closed) return;

            this._logger.debug('kafka consumer rebalance', err && err.message, assignment);

            /* istanbul ignore if */
            if (err && (err.code[ERR__ASSIGN_PARTITIONS] || err.code[ERR__REVOKE_PARTITIONS])) {
                this._incBackOff();
                this._rebalancing = true;
                this._events.emit('rebalance:start', assignment);

                clearTimeout(rebalanceTimeout);
                rebalanceTimeout = setTimeout(() => {
                    this._resetBackOff();

                    this._rebalancing = false;
                    this._events.emit('rebalance:end');
                // this timeout should be configurable?
                }, this._backoff);
            }
        });

        /* istanbul ignore next */
        // @ts-ignore because the event doesn't exist in the typedefinitions
        this._client.on('rebalance.error', this._logOrEmit('rebalance:end', () => {
            clearTimeout(rebalanceTimeout);
            this._rebalancing = false;
        }));

        this._client.on('unsubscribed',  this._logOrEmit('client:unsubscribed'));

        this._client.on('connection.failure',  this._logOrEmit('connect:error'));
    }

    private async _checkState(): Promise<void> {
        if (this._closed) {
            throw new Error('Client is closed');
        }

        if (!this._client.isConnected()) {
            this._logger.debug('waiting for client to connect...');
            await this.connect();
        }

        /* istanbul ignore if */
        if (this._rebalancing) {
            this._logger.debug('waiting for rebalance...');

            await new Promise((resolve) => {
                const eventOff = this._once('rebalance:end', (err) => {
                    if (err) {
                        this._logger.trace('got error while rebalancing', err);
                    }
                    timeoutOff();
                    resolve();
                });

                const timeoutOff = this._timeout((err) => {
                    if (err) {
                        this._logger.trace('got timeout waiting rebalance to finish');
                    }
                    eventOff();
                    resolve();
                }, 30 * 60 * 1000);
            });
        }
    }
}
