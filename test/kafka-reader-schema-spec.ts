import 'jest-extended';
import { TestContext, newTestJobConfig } from '@terascope/job-components';
import Schema from '../asset/src/kafka_reader/schema';

describe('Kafka Reader Schema', () => {
    const context = new TestContext('kafka-reader');
    const schema = new Schema(context);

    afterAll(() => {
        context.apis.foundation.getSystemEvents().removeAllListeners();
    });

    describe('when validating the job', () => {
        it('should throw an error if including json_protocol', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'test-reader',
                    },
                    {
                        _op: 'json_protocol',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrowError('Kafka Reader handles serialization, please remove "json_protocol"');
        });

        it('should not throw if a valid job is given', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'test-reader',
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).not.toThrowError();
        });
    });

    describe('when validating the schema', () => {
        it('should throw an error if no topic is specified', () => {
            expect(() => {
                schema.validate({
                    _op: 'kafka_reader'
                });
            }).toThrowError(/kafka_reader - topic: This field is required and must by of type string/);
        });

        it('should throw an error if no group is specified', () => {
            expect(() => {
                schema.validate({
                    _op: 'kafka_reader',
                    topic: 'hello'
                });
            }).toThrowError(/kafka_reader - group: This field is required and must by of type string/);
        });

        it('should not throw an error if valid config is given', () => {
            expect(() => {
                schema.validate({
                    _op: 'kafka_reader',
                    topic: 'hello',
                    group: 'hello'
                });
            }).not.toThrowError();
        });
    });
});
