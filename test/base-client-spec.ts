import 'jest-extended';
import { EventEmitter } from 'events';
import { debugLogger } from '@terascope/job-components';
import BaseClient from '../asset/src/_kafka_clients/base-client';
import { KafkaError, AnyKafkaError } from '../asset/src/_kafka_helpers';
import * as codes from '../asset/src/_kafka_helpers/error-codes';

describe('Base Client (internal)', () => {
    const logger = debugLogger('base-client');
    class FakeKafkaClient extends EventEmitter {
        connected = true;
        isConnected() {
            return this.connected;
        }
        connect(obj: any, cb: (err: AnyKafkaError, obj: any) => void) {
            cb(null, obj);
        }
        disconnect(cb: (err: AnyKafkaError) => void) {
            cb(null);
        }
    }

    let fakeClient: FakeKafkaClient;

    // @ts-ignore
    let client: BaseClient<TestKafkaClient>;
    let events: EventEmitter;

    beforeEach(() => {
        fakeClient = new FakeKafkaClient();

        BaseClient.DEFAULT_BACKOFF = 10;
        BaseClient.DEFAULT_MAX_RETRIES = 2;
        BaseClient.BACKOFF_RANDOM_FACTOR = [0, 1];

        // @ts-ignore
        client = new BaseClient(fakeClient, 'test-topic', logger);

        // @ts-ignore because it is private
        events = client._events;
    });

    afterEach(() => client.disconnect());

    describe('->disconnect', () => {
        it('should cleanup everything correctly', async () => {
            events.on('test:close', () => {});
            expect(events.listenerCount('test:close')).toBe(1);
            expect(client).toHaveProperty('_closed', false);

            await client.disconnect();

            expect(client).toHaveProperty('_closed', true);
            expect(client).toHaveProperty('_cleanup', []);
            expect(events.listenerCount('test:close')).toBe(0);
        });

        it('should handle an error on disconnect', async () => {
            const original = fakeClient.disconnect;

            fakeClient.disconnect = jest.fn((cb: (err: AnyKafkaError) => void) => {
                const err = new Error('Disconnect error');
                cb(err);
            });

            try {
                await client.disconnect();
            } catch (err) {
                expect(err).toHaveProperty('message',
                    'Failed to disconnect, caused by error: Disconnect error');
            }

            fakeClient.disconnect = original;
        });

        it('should not disconnect if not connected', async () => {
            fakeClient.connected = false;
            fakeClient.disconnect = jest.fn();

            await expect(client.disconnect()).resolves.toBeNil();
            expect(fakeClient.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('->_connect', () => {
        it('should handle an successful connection', async () => {
            // @ts-ignore
            await expect(client._connect()).resolves.toBeNil();
        });

        it('should handle an error on connect', async () => {
            fakeClient.connect = jest.fn((obj: any, cb: (err: AnyKafkaError, obj: any) => void) => {
                const err = new Error('Connect error');
                cb(err, obj);
            });

            try {
                // @ts-ignore
                await client._connect();
            } catch (err) {
                expect(err).toHaveProperty(
                    'message',
                    'Failed to connect, caused by error: Connect error'
                );
            }
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

        it('should fire once and cleanup when close is called', async () => {
            const listener = jest.fn();

            // @ts-ignore because it is private
            client._once('test:once:close', listener);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(events.listenerCount('test:once:close')).toBe(1);

            await client.disconnect();

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

        it('should fire once close is called and cleanup', async () => {
            const cb = jest.fn();

            // @ts-ignore because it is private
            client._timeout(cb, 100);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(1);
            expect(cb).not.toHaveBeenCalled();

            await client.disconnect();

            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(null);

            // @ts-ignore because it is private
            expect(client._cleanup).toBeArrayOfSize(0);
        });
    });

    describe('_logOrEmit', () => {
        const ogDebug = logger.debug;
        const ogWarn = logger.warn;
        const ogError = logger.error;

        beforeEach(() => {
            logger.debug = jest.fn();
            logger.warn = jest.fn();
            logger.error = jest.fn();
        });

        afterEach(() => {
            logger.debug = ogDebug;
            logger.warn = ogWarn;
            logger.error = ogError;
        });

        it('should emit if there is a listener', () => {
            const listener = jest.fn();
            events.on('test:log:event', listener);

            // @ts-ignore because it is private
            client._logOrEmit('test:log:event')('hello');

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith('hello');
        });

        describe('when there is no listener', () => {
            it('should log to debug', () => {
                // @ts-ignore because it is private
                client._logOrEmit('test:log:debug')('hello');

                expect(logger.debug).toHaveBeenCalledTimes(1);
                expect(logger.debug).toHaveBeenCalledWith('kafka client debug for event "test:log:debug"', 'hello');
            });

            it('should log to debug and there is on okay error', () => {
                const error = new Error('Test Kafka Error') as KafkaError;
                error.code = codes.ERR_NO_ERROR;

                // @ts-ignore because it is private
                client._logOrEmit('test:log:debug:error')(error);

                expect(logger.debug).toHaveBeenCalledTimes(1);
                expect(logger.debug).toHaveBeenCalledWith('kafka client debug for event "test:log:debug:error"', error);
            });

            it('should log to warn when given a retryable error', () => {
                const error = new Error('Test Kafka Error') as KafkaError;
                error.code = codes.ERR__TIMED_OUT;

                // @ts-ignore because it is private
                client._logOrEmit('test:log:warn')(error, 'hello');

                expect(logger.warn).toHaveBeenCalledTimes(1);
                expect(logger.warn).toHaveBeenCalledWith(error, 'kafka client warning for event "test:log:warn"');
            });

            it('should log to error when given a fatal error', () => {
                const error = new Error('Test Kafka Error');

                // @ts-ignore because it is private
                client._logOrEmit('test:log:error')(error, 'hello');

                expect(logger.error).toHaveBeenCalledTimes(1);
                expect(logger.error).toHaveBeenCalledWith(error, 'kafka client error for event "test:log:error"');
            });
        });
    });

    describe('_try', () => {
        describe('when the client is closed', () => {
            const ogError = logger.error;

            beforeEach(() => {
                logger.error = jest.fn();
            });

            afterEach(() => {
                logger.error = ogError;
            });

            it('should log an error and return null', async () => {
                const fn = jest.fn(() => 'foo');

                // @ts-ignore because
                client._closed = true;

                // @ts-ignore because it is private
                const result = await client._try(async () => fn());

                expect(result).toBeNull();

                expect(fn).toHaveBeenCalledTimes(0);
                expect(logger.error).toHaveBeenCalled();
            });
        });

        describe('when it succeeds on the first attempt', () => {
            it('should only call the fn once', async () => {
                const fn = jest.fn(() => 'foo');

                // @ts-ignore because it is private
                const result = await client._try(async () => fn(), 'consume');

                expect(result).toEqual('foo');

                expect(fn).toHaveBeenCalledTimes(1);
            });
        });

        describe('when it succeeds on the second attempt', () => {
            it('should call the fn twice', async () => {
                const error = new Error('ERR__TIMED_OUT') as KafkaError;
                error.code = codes.ERR__TIMED_OUT;

                const fn = jest.fn<any, any[]>(() => 'howdy').mockRejectedValueOnce(error);

                // @ts-ignore because it is private
                const result = await client._try(async () => fn(), 'commit');

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

                const fn = jest.fn<any, any[]>(() => 'howdy')
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(okError);

                // @ts-ignore because it is private
                const result = await client._try(async () => fn(), 'commit');

                expect(result).toBeNull();
                expect(fn).toHaveBeenCalledTimes(2);
            });
        });

        describe('when it succeeds on the third attempt', () => {
            it('should call the fn thrice', async () => {
                const error = new Error('ERR__RESOLVE') as KafkaError;
                error.code = codes.ERR__RESOLVE;

                const fn = jest.fn<any, any[]>(() => 'hello')
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error);

                // @ts-ignore because it is private
                const result = await client._try(async () => fn(), 'produce');

                expect(result).toEqual('hello');
                expect(fn).toHaveBeenCalledTimes(3);
            });
        });

        describe('when it fails on the third attempt when a fatal error', () => {
            it('should call the fn thrice and throw', async () => {
                expect.hasAssertions();

                const retryable = new Error('Uh oh') as KafkaError;
                retryable.code = codes.ERR__WAIT_CACHE;

                const error = new Error('Fatal Error');

                const fn = jest.fn<any, any[]>(() => 'hi')
                    .mockRejectedValueOnce(retryable)
                    .mockRejectedValueOnce(retryable)
                    .mockRejectedValueOnce(error);

                try {
                    // @ts-ignore because it is private
                    await client._try(async () => fn(), 'any');
                } catch (err) {
                    expect(err.message).toStartWith('Failure, caused by error: Fatal Error');
                    expect(fn).toHaveBeenCalledTimes(3);
                }
            });
        });

        describe('when it fails on the third attempt when a retryable error', () => {
            it('should call the fn thrice and throw', async () => {
                expect.hasAssertions();

                const error = new Error('ERR__WAIT_CACHE') as KafkaError;
                error.code = codes.ERR__WAIT_CACHE;

                const fn = jest.fn<any, any[]>(() => 'hi')
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error)
                    .mockRejectedValueOnce(error);

                try {
                    // @ts-ignore because it is private
                    await client._try(async () => fn(), 'any');
                } catch (err) {
                    expect(err.message).toStartWith('Failure after retries, caused by error: ERR__WAIT_CACHE');
                    expect(fn).toHaveBeenCalledTimes(3);
                }
            });
        });
    });

    describe('_tryWithEvent', () => {
        describe('when the event does not fire', () => {
            it('should call the fn and cleanup', async () => {
                const fn = jest.fn(() => 'bar');

                // @ts-ignore because it is private
                const result = await client._tryWithEvent('test:try', async () => fn());

                expect(result).toEqual('bar');

                // @ts-ignore
                expect(client._cleanup.length).toBe(0);

                expect(fn).toHaveBeenCalledTimes(1);
            });
        });

        describe('when the event does not fire an error', () => {
            it('should call the fn and cleanup', async () => {
                const fn = jest.fn(() => 'baz');

                // @ts-ignore because it is private
                const result = await client._tryWithEvent('test:try:no-error', async () => {
                    events.emit('test:try:no-error', null);
                    return fn();
                });

                expect(result).toEqual('baz');

                // @ts-ignore
                expect(client._cleanup.length).toBe(0);

                expect(fn).toHaveBeenCalledTimes(1);
            });
        });

        describe('when the event fires with an error', () => {
            it('should call the fn and cleanup', async () => {
                const error = new Error('Uh oh') as KafkaError;

                const fn = jest.fn(() => 'howdy');

                try {
                    // @ts-ignore because it is private
                    await client._tryWithEvent('test:try:error', async () => {
                        events.emit('test:try:error', error);
                        return fn();
                    });
                } catch (err) {
                    expect(err.message).toStartWith('Failure after retries, caused by error: Uh oh');
                }

                // @ts-ignore
                expect(client._cleanup.length).toBe(0);

                expect(fn).toHaveBeenCalledTimes(1);
            });
        });
    });
});
