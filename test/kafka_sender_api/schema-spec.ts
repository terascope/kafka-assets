import 'jest-extended';
import { newTestJobConfig, WorkerTestHarness } from 'teraslice-test-harness';
import { ValidatedJobConfig, TestClientConfig } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import Connector from 'terafoundation_kafka_connector';
import { KafkaSenderAPIConfig, DEFAULT_API_NAME } from '../../asset/src/kafka_sender_api/interfaces.js';
import { kafkaBrokers } from '../helpers/config.js';

describe('Kafka Sender API Schema', () => {
    let harness: WorkerTestHarness;

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        async createClient(config: any, logger: Logger, settings: any) {
            const result = await Connector.createClient(config, logger, settings);
            return result;
        }
    };

    const clients = [clientConfig];

    async function makeTest(apiConfig: Partial<KafkaSenderAPIConfig> = {}) {
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
            await expect(makeTest()).toReject();
            await expect(makeTest({ topic: null })).toReject();
            await expect(makeTest({ topic: 23412341 })).toReject();
        });

        it('should throw an error if configs are incorrect', async () => {
            await expect(makeTest({ id_field: 1234 })).toReject();
            await expect(makeTest({ timestamp_field: 123423 })).toReject();
            await expect(makeTest({ compression: 'someOther' })).toReject();
            await expect(makeTest({ size: 'someOther' })).toReject();
            await expect(makeTest({ size: -1231 })).toReject();
            await expect(makeTest({ max_buffer_size: -1231 })).toReject();
        });

        it('should throw if max_buffer_size is a non-number non-undefined value', async () => {
            await expect(makeTest({ max_buffer_size: 'large' as any })).toReject();
        });

        it('should throw if max_buffer_kbytes_size is not a positive number', async () => {
            await expect(makeTest({ max_buffer_kbytes_size: -1 })).toReject();
            await expect(makeTest({ max_buffer_kbytes_size: 0 })).toReject();
        });

        it('should throw if max_buffer_kbytes_size is a non-number non-undefined value', async () => {
            await expect(makeTest({ max_buffer_kbytes_size: 'large' as any })).toReject();
        });

        it('should accept a valid positive max_buffer_kbytes_size', async () => {
            await expect(makeTest({ topic: 'test', max_buffer_kbytes_size: 1000 })).toResolve();
        });

        it('should throw if delivery_report is not a plain object', async () => {
            await expect(makeTest({ delivery_report: 'invalid' as any })).toReject();
        });

        it('should throw if delivery_report.wait is not a boolean', async () => {
            await expect(makeTest({ delivery_report: { wait: 'yes', only_error: false, on_error: 'log' } as any })).toReject();
        });

        it('should throw if delivery_report.only_error is not a boolean', async () => {
            await expect(makeTest({ delivery_report: { wait: true, only_error: 'yes', on_error: 'log' } as any })).toReject();
        });

        it('should throw if delivery_report.on_error is not a valid value', async () => {
            await expect(makeTest({ delivery_report: { wait: true, only_error: false, on_error: 'invalid' } as any })).toReject();
        });

        it('should set the required_acks default to 1', async () => {
            const apiManager = await makeTest({
                _name: 'kafka_sender_api',
                topic: 'hello',
                size: 1
            });

            await apiManager.create('test', {});

            expect(apiManager.getConfig('test')).toMatchObject({
                topic: 'hello',
                size: 1,
                required_acks: 1
            });
        });

        it('should allow valid rdkafka_options config', async () => {
            await expect(makeTest({ topic: 'test', rdkafka_options: { 'queue.buffering.max.kbytes': 540000 } })).toResolve();
            await expect(makeTest({ topic: 'test', rdkafka_options: {} })).toResolve();
        });
    });
});
