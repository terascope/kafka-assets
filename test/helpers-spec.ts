import 'jest-extended';
import { wrapError, KafkaError, isOkayError } from '../asset/src/_kafka_helpers';
import * as codes from '../asset/src/_kafka_helpers/error-codes';

describe('wrapError helper', () => {
    describe('when given a Error', () => {
        it('should return a correctly formatted error', () => {
            const err = new Error('Uh oh');
            const error = wrapError('Hello', err);
            expect(error.message).toEqual('Hello, caused by error: Uh oh');
        });
    });

    describe('when given a KafkaError', () => {
        it('should return a correctly formatted error', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = -174;
            const error = wrapError('Failure', err);
            expect(error.message).toEqual('Failure, caused by error: Uh oh, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });

    describe('when given a wrappedError', () => {
        it('should return a correctly formatted error', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = -174;
            const wrappedError = wrapError('Failure', err);

            const error = wrapError('Double Failure', wrappedError);
            expect(error.message).toEqual('Double Failure, caused by error: Uh oh, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });

    describe('when given a number', () => {
        it('should return a correctly formatted error', () => {
            const error = wrapError('Failure', -174);
            expect(error.message).toEqual('Failure, caused by error: -174, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });

    describe('when given a string', () => {
        it('should return a correctly formatted error', () => {
            const error = wrapError('Failure', 'bad news bears');
            expect(error.message).toEqual('Failure, caused by error: bad news bears');
        });
    });

    describe('when given a null', () => {
        it('should return a correctly formatted error', () => {
            const error = wrapError('Failure', null);
            expect(error.message).toEqual('Failure');
        });
    });
});

describe('isOkayError helper', () => {
    const alwaysOk = Object.keys(codes.okErrors.any);
    const alwaysBad = [123, -67, 2, -100, null, undefined, 'hello'];

    describe.each([
        codes.KAFKA_NO_OFFSET_STORED,
        codes.ERR__WAIT_COORD,
        codes.ERR_NOT_COORDINATOR_FOR_GROUP,
        codes.ERR__TIMED_OUT_QUEUE,
        ...alwaysOk
    ])('when consuming and checking error code %s', (code) => {
        it('should return true', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'consume')).toBeTrue();
            expect(isOkayError(code, 'consume')).toBeTrue();
        });
    });

    describe.each(alwaysBad)('when consuming and checking error code %s', (code) => {
        it('should return false', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code as string|number;

            expect(isOkayError(err, 'consume')).toBeFalse();
            expect(isOkayError(code, 'consume')).toBeFalse();
        });
    });

    describe.each([
        codes.KAFKA_NO_OFFSET_STORED,
        ...alwaysOk
    ])('when committing and checking error code %s', (code) => {
        it('should return true', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'commit')).toBeTrue();
            expect(isOkayError(code, 'commit')).toBeTrue();
        });
    });

    describe.each([
        codes.ERR__MSG_TIMED_OUT,
        ...alwaysOk
    ])('when producing and checking error code %s', (code) => {
        it('should return true', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'produce')).toBeTrue();
            expect(isOkayError(code, 'produce')).toBeTrue();
        });
    });
});
