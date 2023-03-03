"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const interfaces_1 = require("../../asset/src/kafka_sender_api/interfaces");
const config_1 = require("../helpers/config");
describe('Kafka Sender API Schema', () => {
    let harness;
    const mockFlush = jest.fn();
    const clientConfig = {
        type: 'kafka',
        config: {
            brokers: config_1.kafkaBrokers,
        },
        create(config, logger, settings) {
            const result = terafoundation_kafka_connector_1.default.create(config, logger, settings);
            // @ts-expect-error
            result.client.flush = mockFlush
                // @ts-expect-error
                .mockImplementation(result.client.flush)
                .bind(result.client);
            return result;
        }
    };
    const clients = [clientConfig];
    async function makeTest(apiConfig = {}) {
        const config = Object.assign({ _name: interfaces_1.DEFAULT_API_NAME }, apiConfig);
        const testJob = {
            analytics: true,
            apis: [config],
            operations: [
                { _op: 'test-reader' },
                { _op: 'noop' },
            ],
        };
        const job = (0, teraslice_test_harness_1.newTestJobConfig)(testJob);
        harness = new teraslice_test_harness_1.WorkerTestHarness(job, { clients });
        await harness.initialize();
        return harness.getAPI(interfaces_1.DEFAULT_API_NAME);
    }
    afterEach(async () => {
        if (harness)
            await harness.shutdown();
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
    });
});
//# sourceMappingURL=schema-spec.js.map