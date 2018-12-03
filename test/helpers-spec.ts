import 'jest-extended';
import { wrapError, KafkaError } from '../asset/src/_kafka_helpers';

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

    describe('when given a null', () => {
        it('should return a correctly formatted error', () => {
            const error = wrapError('Failure', null);
            expect(error.message).toEqual('Failure');
        });
    });
});
