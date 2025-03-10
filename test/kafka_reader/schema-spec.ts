import { jest } from '@jest/globals';
import 'jest-extended';
import {
    TestContext,
    newTestJobConfig,
    OpConfig,
    APIConfig,
    ValidatedJobConfig,
    TestClientConfig,
    Logger
} from '@terascope/job-components';
import { WorkerTestHarness } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';
import Schema from '../../asset/src/kafka_reader/schema.js';
import { kafkaBrokers } from '../helpers/config.js';

// increase the timeout because CI has been failing a bit
jest.setTimeout(15_000);

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
            }).toThrow('Kafka Reader handles serialization, please remove "json_protocol"');
        });

        it('should not throw if a valid job is given', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'hello',
                        group: 'hi'
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).not.toThrow();
        });

        it('should inject an api if none is specified', () => {
            const job = newTestJobConfig({
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'hello',
                        group: 'hi'
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
                expect(job.apis).toBeArrayOfSize(1);
                const apiConfig = job.apis[0];
                if (!apiConfig) throw new Error('No api was created');

                expect(apiConfig._name.startsWith('kafka_reader_api')).toBeTrue();
                expect(job.apis[0]).toMatchObject({ topic: 'hello', group: 'hi' });
            }).not.toThrow();
        });

        it('should throw if topic/group is specified differently in opConfig if api is set with api_name', () => {
            const job = newTestJobConfig({
                apis: [
                    { _name: 'kafka_reader_api', topic: 'hello', group: 'hi' }
                ],
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'hello',
                        group: 'something_else',
                        api_name: 'kafka_reader_api'
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrow();
        });

        it('should associate with default kafka sender if no api_name is specified', () => {
            const job = newTestJobConfig({
                apis: [
                    { _name: 'kafka_reader_api:kafka_reader-0', topic: 'hello', group: 'hi' }
                ],
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
            }).not.toThrow();
        });

        it('should associate with default kafka sender and throw if configs are incorrect', () => {
            const job = newTestJobConfig({
                apis: [
                    { _name: 'kafka_reader_api:kafka_reader-0', topic: 'hello', group: 'hi' }
                ],
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'something_else',
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrow();
        });
    });

    describe('when validating the schema', () => {
        const clientConfig: TestClientConfig = {
            type: 'kafka',
            config: {
                brokers: kafkaBrokers,
            },
            createClient(config: any, _logger: Logger, settings: any) {
                return Connector.createClient(config, _logger, settings);
            }
        };
        const clients = [clientConfig];
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

            harness = new WorkerTestHarness(job, { clients });

            await harness.initialize();
        }

        it('should throw an error if no topic is specified', async () => {
            await expect(makeTest({ _op: 'kafka_reader', group: 'hello' })).toReject();
        });

        it('should throw an error if no group is specified', async () => {
            await expect(makeTest({ _op: 'kafka_reader', topic: 'hello' })).toReject();
        });

        it('should not throw an error if valid config is given', async () => {
            await expect(makeTest({ _op: 'kafka_reader', topic: 'hello', group: 'hello' })).toResolve();
        });

        it('should not throw an error if topic or group is provided in api', async () => {
            const opConfig = { _op: 'kafka_reader', api_name: 'kafka_reader_api' };
            const apiConfig: APIConfig = { _name: 'kafka_reader_api', topic: 'hello', group: 'hello' };

            await expect(makeTest(opConfig, apiConfig)).toResolve();
        });
    });
});
