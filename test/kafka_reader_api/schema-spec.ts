import { jest } from '@jest/globals';
import 'jest-extended';
import { newTestJobConfig, WorkerTestHarness } from 'teraslice-test-harness';
import { ValidatedJobConfig, TestClientConfig } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import Connector from 'terafoundation_kafka_connector';
import { kafkaBrokers } from '../helpers/config.js';

describe('Kafka Reader API Schema', () => {
    let harness: WorkerTestHarness;
    const mockFlush = jest.fn();

    const clientConfig: TestClientConfig = {
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
        }
    };

    const clients = [clientConfig];

    async function makeTest(apiConfig: Record<string, any> = {}) {
        const config = Object.assign(
            { _name: 'kafka_reader_api' },
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

        return harness.getAPI('kafka_reader_api');
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

        it('should allow valid rdkafka_options config', async () => {
            await expect(makeTest({ topic: 'test', group: 'testgroup', rdkafka_options: { 'queued.max.messages.kbytes': 540000 } })).toResolve();
            await expect(makeTest({ topic: 'test', group: 'testgroup', rdkafka_options: {} })).toResolve();
        });
    });
});
