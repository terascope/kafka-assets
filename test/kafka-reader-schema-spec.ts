import 'jest-extended';
import {
    TestContext, newTestJobConfig, OpConfig, APIConfig, ValidatedJobConfig
} from '@terascope/job-components';
import { WorkerTestHarness } from 'teraslice-test-harness';
import Schema from '../asset/src/kafka_reader/schema';

describe('Kafka Reader Schema', () => {
    let context: TestContext;
    let schema: Schema;
    let harness: WorkerTestHarness;

    afterAll(() => {
        context.apis.foundation.getSystemEvents().removeAllListeners();
    });

    beforeEach(() => {
        context = new TestContext('kafka-reader');
        schema = new Schema(context);
    });

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    describe('when validating the job', () => {
        it('should throw an error if including json_protocol', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'kafka_reader',
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
                        _op: 'kafka_reader',
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

        it('should inject an api if none is specified', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'kafka_reader',
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
                expect(job.apis).toBeArrayOfSize(1);
                expect(job.apis[0]).toMatchObject({ _name: 'kafka_reader_api' });
            }).not.toThrowError();
        });
    });

    describe('when validating the schema', () => {
        async function makeTest(config: OpConfig, apiConfig?: APIConfig) {
            const testJob: Partial<ValidatedJobConfig> = {
                analytics: true,
                apis: [],
                operations: [
                    config,
                    {
                        _op: 'noop',
                    },
                ],
            };

            if (apiConfig) testJob!.apis!.push(apiConfig);

            const job = newTestJobConfig(testJob);

            harness = new WorkerTestHarness(job);

            await harness.initialize();
        }

        it('should throw an error if no topic is specified', async () => {
            expect(async () => makeTest({ _op: 'kafka_reader' })).toReject();
        });

        it('should throw an error if no group is specified', () => {
            expect(async () => makeTest({ _op: 'kafka_reader', topic: 'hello' })).toReject();
        });

        it('should not throw an error if valid config is given', () => {
            expect(async () => makeTest({ _op: 'kafka_reader', topic: 'hello', group: 'hello' })).toResolve();
        });

        it('should not throw an error if topic is provided in api', () => {
            const opConfig = { _op: 'kafka_reader', group: 'hello' };
            const apiConfig: APIConfig = { _name: 'kafka_reader_api', topic: 'hello' };
            expect(async () => makeTest(opConfig, apiConfig)).toResolve();
        });

        it('should not throw an error if group is provided in api', () => {
            const opConfig = { _op: 'kafka_reader' };
            const apiConfig: APIConfig = { _name: 'kafka_reader_api', topic: 'hello', group: 'hello' };
            expect(async () => makeTest(opConfig, apiConfig)).toResolve();
        });
    });
});
