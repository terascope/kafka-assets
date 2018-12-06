import 'jest-extended';
import { EventEmitter } from 'events';
import { debugLogger } from '@terascope/job-components';
import BaseClient from '../asset/src/_kafka_clients/base-client';

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
        beforeEach(() => {
            logger.warn = jest.fn();
            logger.debug = jest.fn();
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
});
