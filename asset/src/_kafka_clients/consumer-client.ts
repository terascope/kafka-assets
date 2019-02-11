
import * as kafka from 'node-rdkafka';
import {
    wrapError,
    AnyKafkaError,
    KafkaMessage,
    KafkaError,
} from '../_kafka_helpers';
import BaseClient from './base-client';
import {
    TrackedOffsets,
    TopicPartition,
    ConsumerClientConfig,
    CountPerPartition,
    FatalError,
} from './interfaces';
import {
    ERR__ASSIGN_PARTITIONS,
    ERR__REVOKE_PARTITIONS,
} from '../_kafka_helpers/error-codes';

const isProd = process.env.NODE_ENV !== 'test';
/** Maximum number of invalid state errors to get from kafka */
const MAX_INVALID_STATE_COUNT = isProd ? 3 : 1;
/** Minimum number of empty slices to get before checking the state of the client */
const MIN_EMPTY_SLICES = isProd ? 5 : 0;

export default class ConsumerClient extends BaseClient<kafka.KafkaConsumer> {
    private _emptySlices = 0;
    private _rebalancing = false;
    private _hasClientEvents = false;
    private _offsets: TrackedOffsets = {
        started: {},
        ended: {},
    };

    /** last known assignments */
    protected _assignments: TopicPartition[] = [];

    private _pendingOffsets: CountPerPartition = {};
    private _rebalanceTimeout: NodeJS.Timer|undefined;

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        super(client, config.topic, config.logger);
    }

    /**
     * Connect to kafka
     *
     * **NOTE:** If a "connection.failure" event it will retry
    */
    async connect(): Promise<void> {
        this._clientEvents();

        const [off] = await Promise.all([
            this._once('client:ready', () => {}),
            this._tryWithEvent('connect:error', () => this._connect(), 'connect'),
        ]);

        off();
    }

    /**
     * Committed to the last known offsets stored.
    */
    async commit() {
        const errors: Error[] = [];

        const promises = this._flushOffsets('ended')
            .map(async (offset) => {
                await this._checkState();

                this._addPendingCommit(offset);
                return this._try(() => this._client.commit(offset), 'commit')
                    // If a particular topic fails to commit
                    // it should not stop the rest of topics to commit
                    .catch((err) => {
                        /* istanbul ignore next */
                        errors.push(err);
                    });
            });

        await Promise.all(promises);

        /* istanbul ignore next */
        if (errors.length) {
            this._logger.error('kafka failed to commit', errors);
            throw new Error('Kafka failed to commit');
        }
    }

    /**
     * Currently this just logs the pending commits
     *
     * @todo: we might need to handle the error cases better
    */
    handlePendingCommits(): boolean {
        let hasInvalidCommits = true;

        for (const [partition, pending] of Object.entries(this._pendingOffsets)) {
            /* istanbul ignore next */
            if (pending > 2) {
                this._logger.warn(`partition ${partition} for topic ${this._topic} is behind ${pending} commits`);
                hasInvalidCommits = false;
            } else if (pending > 0) {
                this._logger.debug(`partition ${partition} for topic ${this._topic} is behind ${pending} commits`);
            }
        }

        return hasInvalidCommits;
    }

    /**
     * Rollback the offsets to the start of the
     * last batch of messages consumed.
    */
    async rollback() {
        const partitions = this._flushOffsets('started');

        this._logger.warn(`rolling back, ${formatTopar(partitions)}`);

        const promises = partitions.map((topPar) => this.seek(topPar));

        await Promise.all(promises);
    }

    /**
     * Seek to a specific offset in a partition.
     * If an error happens it will attempt to retry
    */
    async seek(topPar: { partition: number, offset: number }): Promise<void> {
        await this._checkState();

        await this._try(() => this._seek(topPar), 'seek');
    }

    /**
     * Get the topic partitions, this useful for find the tracked offsets
    */
    async topicPositions(): Promise<TopicPartition[]> {
        await this._checkState();

        try {
            return this._client.position(null);
        } catch (err) {
            /* istanbul ignore next */
            throw wrapError('Failed to get topic partitions', err);
        }
    }

    /**
     * Consume messages from kafka, and exit after either
     * the specified size is reached or the maximum wait passes.
     *
     * @param map - transform the messages before the returning them,
     *              this is useful to avoid looping over the data twice.
     * @param max.size - the target size of messages to consume
     * @param max.wait - the maximum time to wait before resolving the messages
     */
    async consume<T>(map: (msg: KafkaMessage) => T, max: { size: number, wait: number }): Promise<T[]> {
        this.handlePendingCommits();

        this._logger.trace('consuming...', { size: max.size, wait: max.wait });

        const endAt = Date.now() + max.wait;
        let results: T[] = [];

        while (results.length < max.size && endAt > Date.now()) {
            const remaining = max.size - results.length;
            const remainingMs = endAt - Date.now();
            const timeout = remainingMs > 0 ? remainingMs : 0;

            this._client.setDefaultConsumeTimeout(timeout);

            await this._checkState();
            const consumed = await this._consume(remaining, map);

            results = results.concat(consumed);
        }

        if (!results.length) {
            this._emptySlices++;
            await this._verifyClientState();
        } else {
            this._emptySlices = 0;
            if (this._invalidStateCount > 0) {
                this._invalidStateCount--;
            }
        }

        this._logger.info(`Resolving with ${results.length} results`);
        return results;
    }

    /**
     * Consume messages from kafka, and transform them, and track the offsets.
     */
    private async _consume<T>(count: number, map: (msg: KafkaMessage) => T): Promise<T[]> {
        const results: T[] = [];

        const messages = await this._failIfEvent('client:error', async () => {
            return this._consumeMessages(count);
        }, 'consume');

        /* istanbul ignore next */
        if (messages == null) return [];

        const total = messages.length;

        for (let i = 0; i < total; i++) {
            const message = messages[i];

            this._trackOffsets(message);

            const entity = map(message);
            if (entity != null) {
                results.push(entity);
            }
        }

        return results;
    }

    /**
     * A promisified version consume
     */
    private _consumeMessages(count: number): Promise<KafkaMessage[]> {
        return new Promise((resolve, reject) => {
            this._client.consume(count, (err: AnyKafkaError, messages: KafkaMessage[]) => {
                /* istanbul ignore if */
                if (err) reject(err);
                else resolve(messages);
            });
        });
    }

    /**
     * Build an array of topic partitions based on either
     * the started, or ended, offset positions.
     *
     * **NOTE:** Calling this method will also reset the tracked offsets
     */
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

    /**
     * Update the tracked offset per a given kafka message
     */
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

    /**
     * A promisified method for seeking to particular offset
     */
    private async _seek(topar: TopicPartition): Promise<void> {
        const { partition, offset } = topar;

        return new Promise((resolve, reject) => {
            this._client.seek({
                partition,
                offset,
                topic: this._topic
            }, 1000, (err: AnyKafkaError) => {
                /* istanbul ignore if */
                if (err) {
                    const message = `Failure to seek ${formatTopar(topar)}`;
                    reject(wrapError(message, err));
                    return;
                }

                this._logger.debug(`seeked partition ${formatTopar(topar)}`);
                this._offsets.started[partition] = offset;
                delete this._offsets.ended[partition];
                resolve();
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

        this._client.on('error', this._logOrEmit('client:error'));

        this._client.on('ready', () => {
            this._client.subscribe([this._topic]);

            this._logger.info('kafka consumer is ready');
            this._events.emit('client:ready');

            this._incBackOff();
        });

        /* istanbul ignore next */
        this._client.on('event.log', (msg) => {
            this._logger.info(msg);
        });

        // for event error logs.
        this._client.on('event.error', this._logOrEmit('client:error'));

        this._client.on('unsubscribed',  this._logOrEmit('client:unsubscribed'));

        this._client.on('connection.failure',  this._logOrEmit('connect:error'));

        /* istanbul ignore next */
        // @ts-ignore because the type definition don't work right
        this._client.on('rebalance', (err, assignments) => {
            if (this._closed) return;

            try {
                this._handleRebalance(err, assignments);
            } catch (err) {
                this._logger.error('error handling rebalance', err);
            }
        });

        /* istanbul ignore next */
        // @ts-ignore because the event doesn't exist in the type definitions
        this._client.on('rebalance.error', (err: AnyKafkaError) => {
            const error = wrapError('Rebalance Error', err);
            this._endRebalance(error.stack || error.message);
        });

        // @ts-ignore because the event doesn't exist in the type definitions
        this._client.on('offset.commit', (offsets) => {
            offsets.forEach((offset: TopicPartition) => this._removePendingCommit(offset));
        });
    }

    /**
     * Verify the connection is alive and well
     */
    private async _checkState(): Promise<void> {
        this._throwInvalidStateError();

        await this._connect();
        await this._waitForRebalance();
    }

    /**
     * When a rebalance in-order to prevent unwanted errors
     * this logic will use the backoff interval to avoid performing
     * actions until a certain amount of time passes.
    */
    private _waitForRebalance() {
        if (!this._rebalancing) return;

        this._logger.debug('waiting for rebalance...');

        return new Promise((resolve) => {
            const eventOff = this._once('rebalance:end', () => {
                timeoutOff();
                resolve();
            });

            /* istanbul ignore next */
            const timeoutOff = this._timeout(() => {
                if (this._rebalancing) {
                    this._endRebalance('due rebalance taking too way too long');
                }

                eventOff();
                resolve();
            }, 30 * 60 * 1000);
        });
    }

    /**
     * Set mode to rebalance, the more rebalance or errors that happen
     * will cause it back off longer
    */
    private _startRebalance(msg: string) {
        this._logger.trace(`starting a rebalance ${msg}`);

        this._incBackOff();
        this._rebalancing = true;
        this._events.emit('rebalance:start');

        if (this._rebalanceTimeout) clearTimeout(this._rebalanceTimeout);

        const bkoff = this._backoff;
        this._rebalanceTimeout = setTimeout(() => {
            this._endRebalance(`${msg}, timed out after ${bkoff}ms`);
        }, bkoff);
    }

    /**
     * End the rebalance
    */
    private _endRebalance(msg: string) {
        if (this._rebalanceTimeout) clearTimeout(this._rebalanceTimeout);

        this._logger.trace(`rebalance ended ${msg}`);
        this._rebalancing = false;
        this._events.emit('rebalance:end');
    }

    private _handleRebalance(err: KafkaError|undefined, assignments: TopicPartition[]) {
        if (err && err.code === ERR__ASSIGN_PARTITIONS) {
            this._logger.debug(`got new assignments ${formatTopar(assignments)}`);
            this._assignments = assignments;
            this._endRebalance('due to new assignments');
        } else if (err && err.code === ERR__REVOKE_PARTITIONS) {
            this._logger.debug(`revoking assignments ${formatTopar(assignments)}`);
            this._startRebalance('due to revoked assignments');
        } else {
            this._logger.debug('kafka consumer rebalance', { err, assignments });
        }
    }

    /**
     * When a commit is made, track a pending commit
    */
    private _addPendingCommit(topar: TopicPartition) {
        this._logger.trace(`committing ${formatTopar(topar)}...`);

        if (this._pendingOffsets[topar.partition] == null) {
            this._pendingOffsets[topar.partition] = 0;
        }

        this._pendingOffsets[topar.partition] += 1;
    }

    /**
     * When a commit is acknowledged, untrack the pending commit
    */
    private _removePendingCommit(topar: TopicPartition) {
        this._logger.trace(`commit is acknowledged, ${formatTopar(topar)}`);

        if (this._pendingOffsets[topar.partition] != null) {
            this._pendingOffsets[topar.partition] -= 1;
        }
    }

    /**
     * There is a case when the kafka client
     * will get disconnected from the broker
     * but remain in an invalid state.
     *
     * See the following issue:
     * - https://github.com/Blizzard/node-rdkafka/issues/27
     * - https://github.com/Blizzard/node-rdkafka/issues/182
     * - https://github.com/Blizzard/node-rdkafka/issues/237
    */
    private async _verifyClientState() {
        if (this._emptySlices <= MIN_EMPTY_SLICES) return;
        if (this._invalidStateCount < 1) return;

        const error = new Error('Kafka Client is in an invalid state') as FatalError;
        error.fatalError = true;

        if (this._invalidStateCount <= MAX_INVALID_STATE_COUNT) {
            this._logger.warn(error.message);
            return;
        }

        throw error;
    }

    /**
     * Throw a Fatal Error in the case where the state
    */
    private _throwInvalidStateError() {
        if (this._invalidStateCount < 1) return;

        const error = new Error('Kafka Client is in an invalid state') as FatalError;
        error.fatalError = true;

        if (this._invalidStateCount <= MAX_INVALID_STATE_COUNT) {
            this._logger.warn(error.message);
            return;
        }
        throw error;
    }
}

function formatTopar(input: TopicPartition[]|TopicPartition) {
    const topars: TopicPartition[] = [];

    if (Array.isArray(input)) {
        topars.push(...input);
    } else {
        topars.push(input);
    }

    return topars
        .map((p) => {
            if (p.offset == null) return `partition: ${p.partition}`;
            return `partition: ${p.partition} offset: ${p.offset}`;
        })
        .join(', ');
}
