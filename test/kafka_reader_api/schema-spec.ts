import 'jest-extended';
import { newTestJobConfig, WorkerTestHarness } from 'teraslice-test-harness';
import { ValidatedJobConfig, TestClientConfig, TestContext } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import Connector from 'terafoundation_kafka_connector';
import { connectorConfig } from '../helpers/config.js';
import Schema from '../../asset/src/kafka_reader_api/schema.js';

describe('Kafka Reader API Schema', () => {
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

    describe('when validating deprecated fields', () => {
        const context = new TestContext('kafka-reader-api');
        const schema = new Schema(context, 'api');

        afterAll(() => {
            context.apis.foundation.getSystemEvents().removeAllListeners();
        });

        function deprecatedFields(config: Record<string, any>): string[] {
            const { warnings } = schema.validate({
                _name: 'kafka_reader_api',
                topic: 'test',
                group: 'testgroup',
                ...config
            });
            return warnings.map((warning: any) => warning.reason.reason.field);
        }

        it('should not emit warnings when no deprecated fields are set', () => {
            expect(deprecatedFields({})).toEqual([]);
        });

        it('should warn when offset_reset is set', () => {
            expect(deprecatedFields({ offset_reset: 'earliest' })).toContain('offset_reset');
        });

        it('should warn when max_poll_interval is set', () => {
            expect(deprecatedFields({ max_poll_interval: 300000 })).toContain('max_poll_interval');
        });

        it('should warn when partition_assignment_strategy is set', () => {
            expect(deprecatedFields({ partition_assignment_strategy: 'range' })).toContain('partition_assignment_strategy');
        });

        it('should include a description telling the user to use rdkafka_options', () => {
            const { warnings } = schema.validate({
                _name: 'kafka_reader_api',
                topic: 'test',
                group: 'testgroup',
                offset_reset: 'earliest'
            });

            expect(warnings[0].reason.reason.description)
                .toBe('kafka_reader_api: "offset_reset" is deprecated, use rdkafka_options["auto.offset.reset"] instead');
        });
    });
});
