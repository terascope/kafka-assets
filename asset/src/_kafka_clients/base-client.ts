import { EventEmitter } from 'events';
import once from 'lodash.once';
import { Logger, isError } from '@terascope/job-components';

export default class BaseClient {
    protected _closed: boolean = false;
    protected _events = new EventEmitter();
    protected _logger: Logger;

    private _cleanup: cleanupFn[] = [];

    constructor(logger: Logger) {
        this._logger = logger;
    }

    close() {
        for (const fn of this._cleanup) {
            fn();
        }

        // empty array
        this._cleanup.length = 0;
        this._events.removeAllListeners();
        this._closed = true;
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
                return;
            }
            cb(null, ...args);
        };

        this._events.once(event, handler);

        const off = () => {
            this._events.removeListener(event, handler);
            cb(null);
            this._cleanup = this._cleanup.filter((f) => {
                return f === off;
            });
        };

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
        }, timeoutMs);

        const off = () => {
            clearTimeout(timeout);
            cb(null);
            this._cleanup = this._cleanup.filter((f) => {
                return f === off;
            });
        };

        this._cleanup = [...this._cleanup, off];

        return off;
    }

    /**
     * Make sure the event has a handler or is logged
    */
    protected _logOrEmit(event: string, ...args: any[]) {
        const hasListener = this._events.listenerCount(event) > 0;
        if (hasListener) {
            this._logger.emit(event, ...args);
            return;
        }

        const [arg0] = args;
        if (arg0 && isError(arg0)) {
            this._logger.warn('kafka client emitted an error', arg0);
        } else {
            this._logger.debug(`kafka client ${event}`, ...args);
        }
    }
}

type cleanupFn = () => void;
