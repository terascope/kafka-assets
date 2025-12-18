import { jest } from '@jest/globals';
import 'jest-extended';
import {
    newTestJobConfig, OpConfig, APIConfig,
    ValidatedJobConfig, TestClientConfig
} from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import { WorkerTestHarness } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';
import { kafkaBrokers } from '../helpers/config.js';
import { DEFAULT_API_NAME } from '../../asset/src/kafka_sender_api/schema.js';

describe('Kafka Sender Schema', () => {
    const mockFlush = jest.fn();

    let harness: WorkerTestHarness;
    const connectionEndpoint = 'default';

    const kafkaConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        async createClient(config: any, logger: Logger, settings: any) {
            const result = await Connector.createClient(config, logger, settings);
            // @ts-expect-error
            result.client.flush = mockFlush
                // @ts-expect-error
                .mockImplementation(result.client.flush)
                .bind(result.client);
            return result;
        },
        endpoint: connectionEndpoint
    };

    const clients = [kafkaConfig];

    async function makeTest(config: OpConfig, apiConfig?: APIConfig) {
        const testJob: Partial<ValidatedJobConfig> = {
            analytics: true,
            apis: [],
            operations: [
                { _op: 'test-reader' },
                config,
            ],
        };

        if (apiConfig) testJob!.apis!.push(apiConfig);

        const job = newTestJobConfig(testJob);

        harness = new WorkerTestHarness(job, { clients });

        await harness.initialize();
    }

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    describe('when validating the schema', () => {
        const apiConfig1 = { _name: 'kafka_sender_api' };
        console.log('hello');
        it('should throw an error if no topic is specified', async () => {
            await expect(makeTest({
                _op: 'kafka_sender',
                _api_name: 'kafka_sender_api'
            }, apiConfig1)).toReject();
        });

        it('should not throw an error if valid config is given', async () => {
            try {
                makeTest({
                    _op: 'kafka_sender',
                    _api_name: 'kafka_sender_api',
                    topic: 'hello'
                }, apiConfig1);
                console.log('I did not throw...');
            } catch (err) {
                console.log('@@@ Here is error', err);
            }
            await expect(makeTest({
                _op: 'kafka_sender',
                topic: 'hello'
            }, apiConfig1)).toResolve();
        });

        it('should not throw an error if api and sender make a valid config', async () => {
            const opConfig = { _op: 'kafka_sender', api_name: 'kafka_sender_api' };
            const apiConfig = { _name: 'kafka_sender_api', topic: 'hello' };

            await expect(makeTest(opConfig, apiConfig)).toResolve();
        });

        it('should throw an error if opConfig topic is specified and api is set differently', async () => {
            const opConfig = { _op: 'kafka_sender', topic: 'hello', api_name: 'kafka_sender_api' };
            const apiConfig = { _name: 'kafka_sender_api', topic: 'stuff' };

            await expect(makeTest(opConfig, apiConfig)).toReject();
        });

        it('will not throw if connection configs are specified in apis and not opConfig', async () => {
            const opConfig = { _op: 'kafka_sender', api_name: DEFAULT_API_NAME };
            const apiConfig = {
                _name: DEFAULT_API_NAME,
                topic: 'hello',
                group: 'hello'
            };

            const job = newTestJobConfig({
                apis: [apiConfig],
                operations: [
                    { _op: 'test-reader' },
                    opConfig
                ]
            });

            harness = new WorkerTestHarness(job, { clients });

            await harness.initialize();

            const validatedApiConfig = harness.executionContext.config.apis.find(
                (api: APIConfig) => api._name === DEFAULT_API_NAME
            );

            expect(validatedApiConfig).toMatchObject(apiConfig);
        });
    });
});
