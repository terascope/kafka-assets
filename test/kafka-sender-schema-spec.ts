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
import Schema from '../asset/src/kafka_sender/schema';
import { kafkaBrokers } from './helpers/config';
import Connector from '../packages/terafoundation_kafka_connector/dist';

describe('Kafka Sender Schema', () => {
    const context = new TestContext('kafka-sender');
    const schema = new Schema(context);
    const mockFlush = jest.fn();

    let harness: WorkerTestHarness;
    const connectionEndpoint = 'default';

    const kafkaConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            const result = Connector.create(config, logger, settings);
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
            const opConfig = { _op: 'kafka_sender' };
            const apiConfig = { _name: 'kafka_sender_api', topic: 'hello' };

            await expect(makeTest(opConfig, apiConfig)).toResolve();
        });

        it('should throw an error if opConfig topic is specified and api is set', async () => {
            const opConfig = { _op: 'kafka_sender', topic: 'hello', api_name: 'kafka_sender_api' };
            const apiConfig = { _name: 'kafka_sender_api', topic: 'hello' };

            await expect(makeTest(opConfig, apiConfig)).toReject();
        });

        it('should throw an error topic is specified and api is set when api is indirectly referenced', async () => {
            const opConfig = { _op: 'kafka_sender', topic: 'hello' };
            const apiConfig = { _name: 'kafka_sender_api', topic: 'hello' };

            await expect(makeTest(opConfig, apiConfig)).toReject();
        });

        it('should set the required_acks default to 1', () => {
            expect(schema.validate({
                _op: 'kafka_sender',
                topic: 'hello',
                size: 1
            })).toMatchObject({
                required_acks: 1
            });
        });
    });
});
