import 'jest-extended';
import { wrapError, KafkaError, isOkayError } from '../asset/src/_kafka_helpers';

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

    describe('when given a number', () => {
        it('should return a correctly formatted error', () => {
            const error = wrapError('Failure', -174);
            expect(error.message).toEqual('Failure, caused by error: -174, code: -174, desc: "Revoked partitions (rebalance_cb)"');
        });
    });

    describe('when given a string', () => {
        it('should return a correctly formatted error', () => {
            const error = wrapError('Failure', 'bad news bears');
            expect(error.message).toEqual('Failure, caused by, bad news bears');
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
    describe.each([
        -168,
        -180,
        16,
        -166
    ])('when consuming and checking error code %s', (code) => {
        it('should return true', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'consume')).toBeTrue();
            expect(isOkayError(code, 'consume')).toBeTrue();
        });
    });

    describe.each([
        123,
        -67,
        2,
        -100
    ])('when consuming and checking error code %s', (code) => {
        it('should return false', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'consume')).toBeFalse();
            expect(isOkayError(code, 'consume')).toBeFalse();
        });
    });

    describe('when consuming and given null', () => {
        it('should return false', () => {
            expect(isOkayError(null, 'consume')).toBeFalse();
        });
    });

    describe.each([
        -168,
    ])('when committing and checking error code %s', (code) => {
        it('should return true', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'commit')).toBeTrue();
            expect(isOkayError(code, 'commit')).toBeTrue();
        });
    });

    describe.each([
        123,
        -67,
        2,
        -100
    ])('when committing and checking error code %s', (code) => {
        it('should return false', () => {
            const err = new Error('Uh oh') as KafkaError;
            err.code = code;

            expect(isOkayError(err, 'commit')).toBeFalse();
            expect(isOkayError(code, 'commit')).toBeFalse();
        });
    });

    describe('when comitting and given null', () => {
        it('should return false', () => {
            expect(isOkayError(null, 'commit')).toBeFalse();
        });
    });

});
