import { EventEmitter } from 'events';
import { isError } from '.';

export default class BaseClient {
    protected _events = new EventEmitter();

    protected _onceWithTimeout(event: string, hardTimeout: boolean, timeoutMs = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            this._events.once(event, handler);

            const off = () => {
                this._events.removeListener(event, handler);
            };

            const timeout = setTimeout(() => {
                if (hardTimeout) {
                    handler(new Error(`Timeout waiting for ${event}`));
                } else {
                    handler(null);
                }
            }, timeoutMs);

            function handler(arg: any) {
                clearTimeout(timeout);
                off();
                if (isError(arg)) {
                    reject(arg);
                }
                resolve(arg);
            }
        });
    }
}
