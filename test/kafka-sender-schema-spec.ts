import 'jest-extended';
import { TestContext, newTestJobConfig } from '@terascope/job-components';
import Schema from '../asset/src/kafka_sender/schema';

describe('Kafka Sender Schema', () => {
    const context = new TestContext('kafka-sender');
    const schema = new Schema(context);

    describe('when validating the job', () => {
        it('should throw an error if wait and size is specified but not collect', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'test-reader',
                    },
                    {
                        _op: 'noop',
                    },
                    {
                        _op: 'kafka_sender',
                        wait: 100,
                        size: 100
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrowError('Kafka Sender no longer handles "wait" and "size", use the "collect" op');
        });

        it('should not throw if a valid job is given', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'test-reader',
                    },
                    {
                        _op: 'collect',
                        wait: 100,
                        size: 100,
                    },
                    {
                        _op: 'kafka_sender'
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
                    _op: 'kafka_sender'
                });
            }).toThrowError(/kafka_sender - topic: This field is required and must by of type string/);
        });

        it('should not throw an error if valid config is given', () => {
            expect(() => {
                schema.validate({
                    _op: 'kafka_sender',
                    topic: 'hello'
                });
            }).not.toThrowError();
        });
    });
});
