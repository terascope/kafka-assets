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
     * A safe way to do a once without timeout
     */
    protected _onceWithTimeout(event: string, hardTimeout: boolean, timeoutMs = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            const eventOff = this._safeEventListener(event, (arg: any) => {
                timerOff();
                if (isError(arg)) reject(arg);
                else resolve(arg);
            });

            const timerOff = this._safeTimeout(() => {
                eventOff();
                if (hardTimeout) reject(new Error(`Timeout waiting for ${event}`));
                else resolve(null);
            }, timeoutMs);
        });
    }

    /**
     * Make sure the timeout gets called and cleaned up
     */
    protected _safeTimeout(fn: (...args: any[]) => void, timeout: number) {
        const done = once(fn);
        const handler = (...args: any[]) => {
            done(...args);
            cleanup();
        };

        const timer = setTimeout(handler, timeout);
        const cleanup = () => {
            done(null);
            clearTimeout(timer);
            this._cleanup = this._cleanup.filter((f) => {
                return f === cleanup;
            });
        };

        this._cleanup.push(cleanup);
        return cleanup;
    }

    /**
     * Make sure the event gets called and cleaned up
     */
    protected _safeEventListener(event: string, fn: (...args: any[]) => void) {
        const done = once(fn);
        const handler = (...args: any[]) => {
            done(...args);
            cleanup();
        };

        this._events.once(event, handler);
        const cleanup = () => {
            done(null);
            this._events.removeListener(event, handler);
            this._cleanup = this._cleanup.filter((f) => {
                return f === cleanup;
            });
        };

        this._cleanup.push(cleanup);
        return cleanup;
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
