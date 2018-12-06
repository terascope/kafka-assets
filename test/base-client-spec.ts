import 'jest-extended';
import { EventEmitter } from 'events';
import { debugLogger } from '@terascope/job-components';
import BaseClient from '../asset/src/_kafka_clients/base-client';
import { KafkaError } from '../asset/src/_kafka_helpers';
import * as codes from '../asset/src/_kafka_helpers/error-codes';

describe('Base Client (internal)', () => {
    const logger = debugLogger('base-client');
    let client: BaseClient;
    let events: EventEmitter;

    beforeEach(() => {
        client = new BaseClient(logger);

        // @ts-ignore because it is private
        events = client._events;
    });

    afterEach(() => client.close());

    describe('->close', () => {
        it('should cleanup everything correctly', () => {
            events.on('test:close', () => {});
            expect(events.listenerCount('test:close')).toBe(1);
            expect(client).toHaveProperty('_closed', false);

            client.close();

            expect(client).toHaveProperty('_closed', true);
            expect(client).toHaveProperty('_cleanup', []);
            expect(events.listenerCount('test:close')).toBe(0);
        });
    });

    describe('->_once', () => {
        it('should fire once and cleanup when off is called', () => {
            const listener = jest.fn();

            // @ts-ignore because it is private
            const off = client._once('test:once:off', listener);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(events.listenerCount('test:once:off')).toBe(1);

            off();

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(null);
            expect(events.listenerCount('test:once:off')).toBe(0);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });

        it('should fire once and cleanup when close is called', () => {
            const listener = jest.fn();

            // @ts-ignore because it is private
            client._once('test:once:close', listener);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(events.listenerCount('test:once:close')).toBe(1);

            client.close();

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(null);
            expect(events.listenerCount('test:once:close')).toBe(0);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });

        it('should fire once and cleanup when the event is fired', () => {
            const listener = jest.fn();

            // @ts-ignore because it is private
            client._once('test:once:event', listener);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(events.listenerCount('test:once:event')).toBe(1);

            events.emit('test:once:event');

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(null);
            expect(events.listenerCount('test:once:event')).toBe(0);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });

        it('should fire once and cleanup when the event is fired with an error', () => {
            const listener = jest.fn();

            // @ts-ignore because it is private
            client._once('test:once:event-error', listener);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(events.listenerCount('test:once:event-error')).toBe(1);

            const err = new Error('uh oh');
            events.emit('test:once:event-error', err);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(err);
            expect(events.listenerCount('test:once:event-error')).toBe(0);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });
    });

    describe('->_timeout', () => {
        it('should fire once the timeout is complete and cleanup', (done) => {
            const cb = jest.fn();

            // @ts-ignore because it is private
            client._timeout(cb, 200);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);

            setTimeout(() => {
                expect(cb).toHaveBeenCalledTimes(1);
                expect(cb.mock.calls[0][0].message).toEqual('Timeout of 200ms');

                // @ts-ignore because it is private
                expect(client._cleanup).toBeArrayOfSize(0);
                done();
            }, 250);
        });

        it('should fire once off is called and cleanup', () => {
            const cb = jest.fn();

            // @ts-ignore because it is private
            const off = client._timeout(cb, 100);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);

            off();

            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(null);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });

        it('should fire once close is called and cleanup', () => {
            const cb = jest.fn();

            // @ts-ignore because it is private
            client._timeout(cb, 100);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(cb).not.toHaveBeenCalled();

            client.close();

            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(null);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });
    });

    describe('_logOrEmit', () => {
        const ogWarn = logger.warn;
        const ogDebug = logger.debug;

        beforeEach(() => {
            logger.warn = jest.fn();
            logger.debug = jest.fn();
        });

        afterEach(() => {
            logger.warn = ogWarn;
            logger.debug = ogDebug;
        });

        it('should emit if there is a listener', () => {
            const listener = jest.fn();
            events.on('test:log:event', listener);

            // @ts-ignore because it is private
            client._logOrEmit('test:log:event', 'hello');

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith('hello');
        });

        it('should log to debug if there is no listener', () => {
            // @ts-ignore because it is private
            client._logOrEmit('test:log:debug', 'hello');

            expect(logger.debug).toHaveBeenCalledTimes(1);
            expect(logger.debug).toHaveBeenCalledWith('kafka client debug for event "test:log:debug"', 'hello');
        });

        it('should log to warn if there is no listener', () => {
            const error = new Error('Test Kafka Error');
            // @ts-ignore because it is private
            client._logOrEmit('test:log:error', error, 'hello');

            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledWith('kafka client error for event "test:log:error"', error);
        });
    });

    describe('_try', () => {
        describe('when it succeeds on the first attempt', () => {
            it('should only call the fn once', async () => {
                const fn = jest.fn(() => 'foo');

                // @ts-ignore because it is private
                const result = await client._try(async () => {
                    return fn();
                }, 'consume');

                expect(result).toEqual('foo');

                expect(fn).toHaveBeenCalledTimes(1);
            });
        });

        describe('when it succeeds on the second attempt', () => {
            it('should call the fn twice', async () => {
                const error = new Error('ERR__TIMED_OUT') as KafkaError;
                error.code = codes.ERR__TIMED_OUT;

                const fn = jest.fn(() => 'howdy').mockRejectedValueOnce(error);

                // @ts-ignore because it is private
                const result = await client._try(async () => {
                    return fn();
                }, 'commit');

                expect(result).toEqual('howdy');

                expect(fn).toHaveBeenCalledTimes(2);
            });
        });

        describe('when it throws an okay error on the second attempt', () => {
            it('should call the fn twice', async () => {
                const error = new Error('ERR__TIMED_OUT') as KafkaError;
                error.code = codes.ERR__TIMED_OUT;

                const okError = new Error('KAFKA_NO_OFFSET_STORED') as KafkaError;
                okError.code = codes.KAFKA_NO_OFFSET_STORED;

                const fn = jest.fn(() => 'howdy')
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(okError);

                // @ts-ignore because it is private
                const result = await client._try(async () => {
                    return fn();
                }, 'commit');

                expect(result).toEqual(null);

                expect(fn).toHaveBeenCalledTimes(2);
            });
        });

        describe('when it succeeds on the third attempt', () => {
            it('should call the fn thrice', async () => {
                const error = new Error('ERR__RESOLVE') as KafkaError;
                error.code = codes.ERR__RESOLVE;

                const fn = jest.fn(() => 'hello')
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error);

                // @ts-ignore because it is private
                const result = await client._try(async () => {
                    return fn();
                }, 'produce');

                expect(result).toEqual('hello');

                expect(fn).toHaveBeenCalledTimes(3);
            });
        });

        describe('when it fails on the third attempt when a fatal error', () => {
            it('should call the fn thrice and throw', async () => {
                const retryable = new Error('Uh oh') as KafkaError;
                retryable.code = codes.ERR__WAIT_CACHE;

                const error = new Error('Fatal Error');

                const fn = jest.fn(() => 'hi')
                    .mockRejectedValueOnce(retryable)
                    .mockRejectedValueOnce(retryable)
                    .mockRejectedValueOnce(error);

                try {
                    // @ts-ignore because it is private
                    await client._try(async () => {
                        return fn();
                    }, 'any');
                } catch (err) {
                    expect(err.message).toStartWith('Failure, caused by error: Fatal Error');
                }

                expect(fn).toHaveBeenCalledTimes(3);
            });
        });

        describe('when it fails on the third attempt when a retryable error', () => {
            it('should call the fn thrice and throw', async () => {
                const error = new Error('ERR__WAIT_CACHE') as KafkaError;
                error.code = codes.ERR__WAIT_CACHE;

                const fn = jest.fn(() => 'hi')
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error);

                try {
                    // @ts-ignore because it is private
                    await client._try(async () => {
                        return fn();
                    }, 'any');
                } catch (err) {
                    expect(err.message).toStartWith('Failure after retries, caused by error: ERR__WAIT_CACHE');
                }

                expect(fn).toHaveBeenCalledTimes(3);
            });
        });
    });
});
