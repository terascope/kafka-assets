import { jest } from '@jest/globals';
import 'jest-extended';
import {
    newTestJobConfig,
    OpConfig,
    APIConfig,
    ValidatedJobConfig,
    TestClientConfig,
    Logger
} from '@terascope/job-components';
import { WorkerTestHarness } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';
import { kafkaBrokers } from '../helpers/config.js';

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
        it('should throw an error if no topic is specified', async () => {
            await expect(makeTest({
                _op: 'kafka_sender'
            })).toReject();
        });

        it('should not throw an error if valid config is given', async () => {
            await expect(makeTest({
                _op: 'kafka_sender',
                topic: 'hello'
            })).toResolve();
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
    });
});
