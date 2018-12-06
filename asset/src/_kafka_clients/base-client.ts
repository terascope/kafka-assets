import { EventEmitter } from 'events';
import once from 'lodash.once';
import { Logger, isError, pDelay } from '@terascope/job-components';
import { isOkayError, wrapError } from '../_kafka_helpers';
import { OkErrors } from '../_kafka_helpers/error-codes';

export default class BaseClient {
    protected _closed: boolean = false;
    protected _events = new EventEmitter();
    protected _logger: Logger;

    private _cleanup: cleanupFn[] = [];
    private _backoff: number = defaultBackOff;

    constructor(logger: Logger) {
        this._logger = logger;
    }

    close() {
        for (const fn of this._cleanup) {
            fn();
        }

        this._cleanup = [];
        this._events.removeAllListeners();
        this._closed = true;
    }

    /**
     * Make sure the event has a handler or is logged
    */
    protected _logOrEmit(event: string, ...args: any[]) {
        const hasListener = this._events.listenerCount(event) > 0;
        if (hasListener) {
            this._events.emit(event, ...args);
            return;
        }

        const [arg0] = args;
        if (arg0 && isError(arg0)) {
            this._logger.warn(`kafka client error for event "${event}"`, arg0);
        } else {
            this._logger.debug(`kafka client debug for event "${event}"`, ...args);
        }
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
     * Try a async fn n times and back off after each attempt
     * NOTE: It will only retry if it is a retryable kafka error
    */
    protected async _try<T>(fn: tryFn<T>, action: keyof OkErrors = 'any', retries = 2): Promise<T|null> {
        try {
            const result = await fn();
            return result;
        } catch (err) {
            const actionStr = action === 'any' ? '' : ` when performing ${action}`;

            if (isOkayError(err, action)) {
                return null;
            }

            const isRetryableError = isOkayError(err, 'retryable');

            if (retries > 0 && isRetryableError) {
                this._backoff += getBackOff();
                await pDelay(this._backoff);

                this._logger.warn(`got retryable kafka${actionStr}, will retry in ${this._backoff}ms`, err);
                return this._try(fn, action, retries - 1);
            }

            // reset the backoff interval
            this._backoff = defaultBackOff;

            if (isRetryableError) {
                throw wrapError(`Failure${actionStr} after retries`, err);
            }

            throw wrapError(`Failure${actionStr}`, err);
        }
    }
}

// get random number inclusive
function getRandom(min: number, max: number) {
    return Math.random() * (max - min + 1) + min; // The maximum is inclusive and the minimum is inclusive
}

/** get a random backoff interval */
function getBackOff() {
    return Math.round(defaultBackOff * getRandom(1, 5));
}

const defaultBackOff = 100;

type cleanupFn = () => void;
type tryFn<T> = () => Promise<T>;
