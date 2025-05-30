import kafka from 'node-rdkafka';
import {
    pDelay, toHumanTime, EncodingConfig,
    isBoolean, isNotNil
} from '@terascope/job-components';
import {
    wrapError, AnyKafkaError, KafkaMessage,
    KafkaError,
} from '../_kafka_helpers/index.js';
import BaseClient, { getRandom } from './base-client.js';
import {
    TrackedOffsets, TopicPartition, ConsumerClientConfig,
    CountPerPartition, FatalError, OffsetByPartition,
} from './interfaces.js';
import {
    ERR__ASSIGN_PARTITIONS,
    ERR__REVOKE_PARTITIONS,
} from '../_kafka_helpers/error-codes.js';

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
        started: {} as OffsetByPartition,
        ended: {} as OffsetByPartition,
    };

    protected encoding: EncodingConfig = {};
    /** last known assignments */
    protected _assignments: TopicPartition[] = [];

    private _pendingOffsets: CountPerPartition = {};
    private _rebalanceTimeout: NodeJS.Timeout | undefined;
    private rollbackOnFailure = false;
    private useCommitSync: boolean;
    private _bytesConsumed = 0;

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        super(client, config.topic, config.logger);
        const {
            _encoding, rollback_on_failure, use_commit_sync
        } = config;
        this.encoding._encoding = _encoding;

        if (isNotNil(rollback_on_failure) && isBoolean(rollback_on_failure)) {
            this.rollbackOnFailure = rollback_on_failure;
        }

        if (isNotNil(use_commit_sync) && isBoolean(use_commit_sync)) {
            this.useCommitSync = use_commit_sync;
        } else {
            this.useCommitSync = false;
        }
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

        if (off) off();
    }

    /**
     * Committed to the last known offsets stored.
    */
    async commit(): Promise<void> {
        const errors: Error[] = [];

        const promises = this._flushOffsets('ended')
            .map(async (offset, i) => {
                this._addPendingCommit(offset);
                return this._try(async () => {
                    // add a random delay to stagger commits
                    await pDelay(i * getRandom(2, 30));
                    if (this.useCommitSync) {
                        await this._client.commitSync(offset);
                    } else {
                        await this._client.commit(offset);
                    }
                }, 'commit')
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

    async retry(): Promise<void> {
        if (this.rollbackOnFailure) {
            await this.rollback();
        } else {
            this._logger.warn('committing kafka offsets on slice retry - THIS MAY CAUSE DATA LOSS');
            await this.commit();
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
    async rollback(): Promise<void> {
        const partitions = this._flushOffsets('started');

        this._logger.warn(`rolling back, ${formatTopar(partitions)}`);

        const promises = partitions.map((topPar) => this.seek(topPar));

        await Promise.all(promises);
    }

    /**
     * Seek to a specific offset in a partition.
     * If an error happens it will attempt to retry
    */
    async seek(topPar: { partition: number; offset: number }): Promise<void> {
        await this._try(() => this._seek({
            ...topPar, topic: this._topic
        }), 'seek');
    }

    /**
     * Get the topic partitions, this useful for find the tracked offsets
    */
    async topicPositions(): Promise<TopicPartition[]> {
        try {
            return this._client.position(undefined);
        } catch (err) {
            /* istanbul ignore next */
            throw wrapError('Failed to get topic partitions', err);
        }
    }

    /**
     * Get the number of partitions consumer is connected to for a specific topic
     * @param topic - topic the partitions belong to
    */
    async getPartitionCount(topic: string): Promise<number> {
        const topicPartitions = await this.topicPositions();
        const filtered = topicPartitions.filter((toppar) => toppar.topic === topic);
        return filtered.length;
    }

    /**
     * Get the number of bytes consumer has consumed
    */
    async getBytesConsumed() {
        return this._bytesConsumed;
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

    async consume<T>(
        map: (msg: KafkaMessage) => T,
        max: { size: number; wait: number }
    ): Promise<T[]> {
        this.handlePendingCommits();
        const start = Date.now();
        const endAt = start + max.wait;
        this._logger.trace('consuming...', { size: max.size, wait: max.wait });

        let results: T[] = [];

        while (results.length < max.size && endAt > Date.now()) {
            const remaining = max.size - results.length;
            const consumed = await this._consume<T>(remaining, map);

            results = results.concat(consumed);
        }

        if (!results.length) {
            this._emptySlices++;
            this._throwInvalidStateError();
        } else {
            this._emptySlices = 0;
            if (this._invalidStateCount > 0) {
                this._invalidStateCount--;
            }
        }

        this._logger.info(`Resolving with ${results.length} results, took ${toHumanTime(Date.now() - start)}`);
        return results;
    }

    /**
     * Consume messages from kafka, and transform them, and track the offsets.
     */
    private async _consume<T>(count: number, map: (msg: KafkaMessage) => T): Promise<T[]> {
        const results: T[] = [];

        const messages = await this._failIfEvent('client:error', async () => this._consumeMessages(count), 'consume');

        /* istanbul ignore next */
        if (messages == null) return [];

        const total = messages.length;

        for (let i = 0; i < total; i++) {
            const message = messages[i];

            this._bytesConsumed += message.size;
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
        return new Promise<KafkaMessage[]>((resolve, reject) => {
            this._client.consume(count, (err: KafkaError, messages: KafkaMessage[]) => {
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
            const offset = this._offsets[key][partition as any];

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

        return new Promise<void>((resolve, reject) => {
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

        this._client.on('error' as any, this._logOrEmit('client:error'));

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

        this._client.on('unsubscribed', this._logOrEmit('client:unsubscribed'));

        this._client.on('connection.failure', this._logOrEmit('connect:error'));

        /* istanbul ignore next */
        this._client.on('rebalance', (err: KafkaError | undefined, assignments: Omit<TopicPartition, 'offset'>[]) => {
            if (this._closed) return;

            try {
                this._handleRebalance(err, assignments as TopicPartition[]);
            } catch (_err) {
                this._logger.error(_err, 'failure handling rebalance');
            }
        });

        /* istanbul ignore next */
        this._client.on('rebalance.error', (err: AnyKafkaError) => {
            const error = wrapError('Rebalance Error', err);
            this._endRebalance(error.stack || error.message);
        });

        this._client.on('offset.commit', (_err, _offsets) => {
            let err: AnyKafkaError | null = null;
            let offsets: TopicPartition[] = [];
            // the change the way this event is called
            if (_offsets && Array.isArray(_offsets)) {
                err = _err;
                offsets = _offsets;
            } else if (_err && Array.isArray(_err)) {
                err = null;
                offsets = _err;
            }
            // log error if we get one
            if (err) this._logger.warn(err, 'offset commit error', { offsets });

            if (!Array.isArray(offsets)) {
                this._logger.trace('Invalid event data for offset.commit', offsets);
                return;
            }

            offsets.forEach((offset: TopicPartition) => this._removePendingCommit(offset));
        });
    }

    /**
     * Verify the connection is alive and well
     */
    protected async _beforeTry(): Promise<void> {
        await this._connect();
        await this._waitForRebalance();

        if (this._invalidStateCount > 0) {
            await pDelay(this._invalidStateCount * 1000);
        }

        this._throwInvalidStateError();
    }

    /**
     * When a rebalance in-order to prevent unwanted errors
     * this logic will use the backoff interval to avoid performing
     * actions until a certain amount of time passes.
    */
    private _waitForRebalance() {
        if (!this._rebalancing) return;

        this._logger.debug('waiting for rebalance...');

        return new Promise<void>((resolve) => {
            let timeoutOff = () => {};

            const eventOff = this._once('rebalance:end', () => {
                timeoutOff();
                resolve();
            });

            /* istanbul ignore next */
            timeoutOff = this._timeout(() => {
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

    private _handleRebalance(err: KafkaError | undefined, assignments: TopicPartition[]) {
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
     * When in an invalid state, throw a Fatal Error
     *
     * This can happen in the case when the kafka client
     * will get disconnected from the broker
     * but remain in an invalid state.
     *
     * See the following issue:
     * - https://github.com/Blizzard/node-rdkafka/issues/27
     * - https://github.com/Blizzard/node-rdkafka/issues/182
     * - https://github.com/Blizzard/node-rdkafka/issues/237
    */
    private _throwInvalidStateError() {
        if (!this.isConnected() || this._rebalancing) return;
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
}

function formatTopar(input: TopicPartition[] | TopicPartition) {
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
