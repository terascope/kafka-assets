import 'jest-extended';
import { newTestJobConfig, WorkerTestHarness } from 'teraslice-test-harness';
import { ValidatedJobConfig, TestClientConfig, Logger } from '@terascope/job-components';
import { KafkaReaderAPIConfig, DEFAULT_API_NAME } from '../../asset/src/kafka_reader_api/interfaces';
import Connector from '../../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers } from '../helpers/config';

describe('Kafka Reader API Schema', () => {
    let harness: WorkerTestHarness;
    const mockFlush = jest.fn();

    const clientConfig: TestClientConfig = {
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
        }
    };

    const clients = [clientConfig];

    async function makeTest(apiConfig: Partial<KafkaReaderAPIConfig> = {}) {
        const config = Object.assign(
            { _name: DEFAULT_API_NAME },
            apiConfig
        );

        const testJob: Partial<ValidatedJobConfig> = {
            analytics: true,
            apis: [config],
            operations: [
                { _op: 'test-reader' },
                { _op: 'noop' },
            ],
        };

        const job = newTestJobConfig(testJob);

        harness = new WorkerTestHarness(job, { clients });
        await harness.initialize();

        return harness.getAPI(DEFAULT_API_NAME);
    }

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    describe('when validating the schema', () => {
        it('should throw an error if no topic is incorrect', async () => {
            await expect(makeTest({ group: 'someGroup' })).toReject();
            await expect(makeTest({ topic: null, group: 'someGroup' })).toReject();
            await expect(makeTest({ topic: 23412341, group: 'someGroup' })).toReject();
        });

        it('should throw an error if no group is incorrect', async () => {
            await expect(makeTest({ topic: 'topic' })).toReject();
            await expect(makeTest({ topic: 'topic', group: 1234123 })).toReject();
            await expect(makeTest({ topic: 'topic', group: ['hello'] })).toReject();
        });

        it('should throw an error if configs are incorrect', async () => {
            await expect(makeTest({ id_field: 1234 })).toReject();
            await expect(makeTest({ compression: 'someother' })).toReject();
            await expect(makeTest({ size: 'someother' })).toReject();
            await expect(makeTest({ offset_reset: -1231 })).toReject();
            await expect(makeTest({ offset_reset: 'hello' })).toReject();
        });
    });
});
