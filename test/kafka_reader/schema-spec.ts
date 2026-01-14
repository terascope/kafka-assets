import { jest } from '@jest/globals';
import 'jest-extended';
import {
    TestContext, newTestJobConfig, OpConfig,
    APIConfig, ValidatedJobConfig, TestClientConfig
} from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
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
                        _api_name: 'kafka_reader-api'
                    },
                    {
                        _op: 'json_protocol',
                    }
                ],
                apis: [
                    {
                        _name: 'kafka_reader_api'
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
                        _api_name: 'kafka_reader_api'
                    },
                    {
                        _op: 'noop',
                    }
                ],
                apis: [
                    {
                        _name: 'kafka_reader_api',
                        topic: 'hello',
                        group: 'hi'
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).not.toThrow();
        });

        // FIXME: Should no longer allow this
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
            const apiConfig: APIConfig = { _name: 'kafka_reader_api', group: 'hello' };
            const opConfig: OpConfig = { _op: 'kafka_reader', _api_name: 'kafka_reader_api' };
            await expect(makeTest(opConfig, apiConfig)).toReject();
        });

        it('should throw an error if no group is specified', async () => {
            const apiConfig: APIConfig = { _name: 'kafka_reader_api', topic: 'hello' };
            const opConfig: OpConfig = { _op: 'kafka_reader', _api_name: 'kafka_reader_api' };
            await expect(makeTest(opConfig, apiConfig)).toReject();
        });

        it('should throw an error if no api is present', async () => {
            await expect(makeTest({ _op: 'kafka_reader', topic: 'hello', group: 'hello' })).toReject();
        });

        it('should not throw an error if topic or group is provided in api', async () => {
            const opConfig = { _op: 'kafka_reader', _api_name: 'kafka_reader_api' };
            const apiConfig: APIConfig = { _name: 'kafka_reader_api', topic: 'hello', group: 'hello' };

            await expect(makeTest(opConfig, apiConfig)).toResolve();
        });

        // FIXME: This test is obsolete and we should check for this
        it('will not throw if connection configs are specified in apis and not opConfig', async () => {
            const opConfig = { _op: 'kafka_reader', _api_name: 'kafka_reader_api' };
            const apiConfig = {
                _name: 'kafka_reader_api',
                topic: 'hello',
                group: 'hello'
            };

            const job = newTestJobConfig({
                apis: [apiConfig],
                operations: [
                    opConfig,
                    {
                        _op: 'noop'
                    }
                ]
            });

            harness = new WorkerTestHarness(job, { clients });

            await harness.initialize();

            const validatedApiConfig = harness.executionContext.config.apis.find(
                (api: APIConfig) => api._name === 'kafka_reader_api'
            );

            expect(validatedApiConfig).toMatchObject(apiConfig);
        });
    });
});
