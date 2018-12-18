import { EventEmitter } from 'events';
import once from 'lodash.once';
import { Logger, isError, pDelay } from '@terascope/job-components';
import {
    isOkayError,
    wrapError,
    isKafkaError,
    AnyKafkaError
} from '../_kafka_helpers';
import * as kafka from 'node-rdkafka';

export default class BaseClient<T extends kafka.Client> {
    protected _closed: boolean = false;
    protected _backoff: number = defaultBackOff;

    protected readonly _events = new EventEmitter();
    protected readonly _logger: Logger;
    protected readonly _client: T;

    private _cleanup: cleanupFn[] = [];

    constructor(client: T, logger: Logger) {
        this._logger = logger;
        this._client = client;
    }

    /**
     * Disconnect from Kafka and cleanup.
    */
    async disconnect() {
        this._closed = true;

        if (this._client.isConnected()) {
            await new Promise((resolve, reject) => {
                this._client.disconnect((err: AnyKafkaError) => {
                    if (err) reject(wrapError('Failed to disconnect', err));
                    else resolve();
                });
            });
        }

        for (const fn of this._cleanup) {
            fn();
        }

        this._cleanup = [];
        this._client.removeAllListeners();
        this._events.removeAllListeners();
    }

    /** A promisified version of connect */
    protected _connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._client.connect({}, (err: AnyKafkaError) => {
                if (err) reject(wrapError('Failed to connect', err));
                else resolve();
            });
        });
    }

    /**
     * Make sure the event has a handler or is logged
    */
    protected _logOrEmit(event: string, fn = () => {}) {
        return (...args: any[]) => {
            fn();
            const hasListener = this._events.listenerCount(event) > 0;
            if (hasListener) {
                this._events.emit(event, ...args);
                return;
            }

            const [err] = args;

            if (err && isError(err)) {
                if (isOkayError(err, 'retryable')) {
                    this._logger.warn(`kafka client warning for event "${event}"`, err);
                    return;
                }

                if (!isKafkaError(err) || !isOkayError(err, 'any')) {
                    this._logger.error(`kafka client error for event "${event}"`, err);
                    return;
                }
            }

            this._logger.debug(`kafka client debug for event "${event}"`, ...args);
        };
    }

    /**
     * A safe once event listener that will return an error first
     * Guaranteed to call the callback at least once
     * @returns an off function to the event listener
    */
    protected _once(event: string, fn: (err: Error|null, ...args: any[]) => void) {
        const cb = once(fn);
        const handler = (...args: any) => {
            if (args[0] && isError(args[0])) {
                cb(args[0]);
                off();
                return;
            }
            cb(null, ...args);
            off();
        };

        this._events.once(event, handler);

        const off = once(() => {
            this._events.removeListener(event, handler);
            cb(null);
            this._cleanup = this._cleanup.filter((f) => {
                return f !== off;
            });
        });

        this._cleanup = [...this._cleanup, off];

        return off;
    }

    /**
     * A safe timeout, if the timeout fires the first arg will be an error
     * Guaranteed to call the callback at least once
     * @returns an off function to cleanup the timer
    */
    protected _timeout(fn: (err: Error|null) => void, timeoutMs: number) {
        const cb = once(fn);
        const timeout = setTimeout(() => {
            const error = new Error(`Timeout of ${timeoutMs}ms`);
            Error.captureStackTrace(error, this._timeout);
            cb(error);
            off();
        }, timeoutMs);

        const off = once(() => {
            clearTimeout(timeout);
            cb(null);
            this._cleanup = this._cleanup.filter((f) => {
                return f !== off;
            });
        });

        this._cleanup = [...this._cleanup, off];

        return off;
    }

    /**
     * Perform an action, fail if the function fails,
     * or the event emits an error
    */
    protected async _failIfEvent<T extends tryFn>(event: string, fn: T, action: string = 'any'): RetryResult<T> {
        return this._tryWithEvent(event, fn, action, 0);
    }

     /**
     * Perform an action, retry if the function fails,
     * or the event emits an error
    */
    protected async _tryWithEvent<T extends tryFn>(event: string, fn: T, action: string = 'any', retries = 2): RetryResult<T> {
        let eventError: Error|null = null;

        const off = this._once(event, (err) => {
            eventError = err;
        });

        try {
            return this._try(() => {
                if (eventError) {
                    throw eventError;
                }

                return fn();
            }, action, retries);
        } finally {
            off();
        }
    }

    /**
     * Try a async fn n times and back off after each attempt
     * NOTE: It will only retry if it is a retryable kafka error
    */
    protected async _try<T extends tryFn>(fn: T, action: string = 'any', retries = 2): RetryResult<T>  {
        const actionStr = action === 'any' ? '' : ` when performing ${action}`;
        if (this._closed) {
            this._logger.error(`Kafka client closed${actionStr}`);
            return null;
        }

        try {
            const result = await fn();
            this._resetBackOff();
            return result;
        } catch (err) {
            if (isOkayError(err, action)) {
                return null;
            }

            const isRetryableError = isOkayError(err, 'retryable');

            if (retries > 0 && isRetryableError) {
                this._incBackOff();
                await pDelay(this._backoff);

                this._logger.warn(`got retryable kafka${actionStr}, will retry in ${this._backoff}ms`, err);
                return this._try(fn, action, retries - 1);
            }

            this._resetBackOff();

            if (isRetryableError) {
                throw wrapError(`Failure${actionStr} after retries`, err);
            }

            throw wrapError(`Failure${actionStr}`, err);
        }
    }

    protected _incBackOff() {
        this._backoff += Math.round(defaultBackOff * getRandom(1, 5));
    }

    protected _resetBackOff() {
        this._backoff = defaultBackOff;
    }
}

// get random number inclusive
function getRandom(min: number, max: number) {
    return Math.random() * (max - min + 1) + min; // The maximum is inclusive and the minimum is inclusive
}

const defaultBackOff = 100;

type cleanupFn = () => void;
export type tryFn = () => any;
type RetryResult<T extends tryFn> = Promise<ReturnType<T>|null>;
