import 'jest-extended';
import { newTestJobConfig, WorkerTestHarness } from 'teraslice-test-harness';
import { ValidatedJobConfig, TestClientConfig, TestContext } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import { KafkaSenderAPIConfig, DEFAULT_API_NAME } from '../../asset/src/kafka_sender_api/interfaces.js';
import Connector from 'terafoundation_kafka_connector';
import Schema from '../../asset/src/kafka_sender_api/schema.js';
import { connectorConfig } from '../helpers/config.js';

describe('Kafka Sender API Schema', () => {
    let harness: WorkerTestHarness;

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            ...connectorConfig,
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

        it('should throw if delivery_report.waitTimeout is missing when wait is true', async () => {
            await expect(makeTest({ delivery_report: { wait: true, only_error: false, on_error: 'log' } as any })).toReject();
        });

        it('should throw if delivery_report.waitTimeout is not a positive number when wait is true', async () => {
            await expect(makeTest({ delivery_report: { wait: true, waitTimeout: 0, only_error: false, on_error: 'log' } as any })).toReject();
            await expect(makeTest({ delivery_report: { wait: true, waitTimeout: -1, only_error: false, on_error: 'log' } as any })).toReject();
            await expect(makeTest({ delivery_report: { wait: true, waitTimeout: 'long', only_error: false, on_error: 'log' } as any })).toReject();
        });

        it('should throw if delivery_report.only_error is not a boolean', async () => {
            await expect(makeTest({ delivery_report: { wait: true, waitTimeout: 10000, only_error: 'yes', on_error: 'log' } as any })).toReject();
        });

        it('should throw if delivery_report.on_error is not a valid value', async () => {
            await expect(makeTest({ delivery_report: { wait: true, waitTimeout: 10000, only_error: false, on_error: 'invalid' } as any })).toReject();
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

        it('should throw when delivery_report is set but dr_cb and dr_msg_cb are both false', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: true, waitTimeout: 10000, only_error: false, on_error: 'log' },
                rdkafka_options: { dr_cb: false, dr_msg_cb: false }
            })).toReject();
        });

        it('should throw when delivery_report is set and dr_cb is false with dr_msg_cb not set', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: true, waitTimeout: 10000, only_error: false, on_error: 'log' },
                rdkafka_options: { dr_cb: false }
            })).toReject();
        });

        it('should throw when delivery_report is set and dr_msg_cb is false with dr_cb not set', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: true, waitTimeout: 10000, only_error: false, on_error: 'log' },
                rdkafka_options: { dr_msg_cb: false }
            })).toReject();
        });

        it('should not throw when delivery_report is set with dr_cb false but dr_msg_cb true', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: true, waitTimeout: 10000, only_error: false, on_error: 'log' },
                rdkafka_options: { dr_cb: false, dr_msg_cb: true }
            })).toResolve();
        });

        it('should not throw when delivery_report is set with dr_msg_cb false but dr_cb true', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: true, waitTimeout: 10000, only_error: false, on_error: 'log' },
                rdkafka_options: { dr_msg_cb: false, dr_cb: true }
            })).toResolve();
        });

        it('should throw when delivery_report.on_error is throw but wait is false', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: false, only_error: false, on_error: 'throw' },
                rdkafka_options: { dr_cb: true }
            })).toReject();
        });

        it('should throw when delivery_report.only_error is true but wait is also true', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: true, waitTimeout: 10000, only_error: true, on_error: 'log' },
                rdkafka_options: { dr_cb: true }
            })).toReject();
        });

        it('should throw when both delivery_report.only_error and rdkafka delivery.report.only.error are set', async () => {
            await expect(makeTest({
                topic: 'hello',
                delivery_report: { wait: false, only_error: false, on_error: 'log' },
                rdkafka_options: { dr_cb: true, 'delivery.report.only.error': true }
            })).toReject();
        });
    });

    describe('when validating deprecated fields', () => {
        const context = new TestContext('kafka-sender-api');
        const schema = new Schema(context, 'api');

        afterAll(() => {
            context.apis.foundation.getSystemEvents().removeAllListeners();
        });

        function deprecatedFields(config: Record<string, any>): string[] {
            const { warnings } = schema.validate({
                _name: DEFAULT_API_NAME,
                topic: 'test',
                ...config
            });
            return warnings.map((warning: any) => warning.reason.reason.field);
        }

        it('should not emit warnings when no deprecated fields are set', () => {
            expect(deprecatedFields({})).toEqual([]);
        });

        it('should warn when compression is set', () => {
            expect(deprecatedFields({ compression: 'gzip' })).toContain('compression');
        });

        it('should warn when wait is set', () => {
            expect(deprecatedFields({ wait: 500 })).toContain('wait');
        });

        it('should warn when size is set', () => {
            expect(deprecatedFields({ size: 1000 })).toContain('size');
        });

        it('should warn when max_buffer_size is set', () => {
            expect(deprecatedFields({ max_buffer_size: 1000 })).toContain('max_buffer_size');
        });

        it('should warn when max_buffer_kbytes_size is set', () => {
            expect(deprecatedFields({ max_buffer_kbytes_size: 1000 })).toContain('max_buffer_kbytes_size');
        });

        it('should warn when metadata_refresh is set', () => {
            expect(deprecatedFields({ metadata_refresh: '5 minutes' })).toContain('metadata_refresh');
        });

        it('should warn when required_acks is set', () => {
            expect(deprecatedFields({ required_acks: 1 })).toContain('required_acks');
        });

        it('should include a description telling the user to use rdkafka_options', () => {
            const { warnings } = schema.validate({
                _name: DEFAULT_API_NAME,
                topic: 'test',
                compression: 'gzip'
            });

            expect(warnings[0].reason.reason.description)
                .toBe('kafka_sender_api: "compression" is deprecated, use rdkafka_options["compression.codec"] instead');
        });
    });
});
