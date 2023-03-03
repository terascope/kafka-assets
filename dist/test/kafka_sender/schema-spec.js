"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const job_components_1 = require("@terascope/job-components");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const config_1 = require("../helpers/config");
describe('Kafka Sender Schema', () => {
    const mockFlush = jest.fn();
    let harness;
    const connectionEndpoint = 'default';
    const kafkaConfig = {
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
        },
        endpoint: connectionEndpoint
    };
    const clients = [kafkaConfig];
    async function makeTest(config, apiConfig) {
        const testJob = {
            analytics: true,
            apis: [],
            operations: [
                { _op: 'test-reader' },
                config,
            ],
        };
        if (apiConfig)
            testJob.apis.push(apiConfig);
        const job = (0, job_components_1.newTestJobConfig)(testJob);
        harness = new teraslice_test_harness_1.WorkerTestHarness(job, { clients });
        await harness.initialize();
    }
    afterEach(async () => {
        if (harness)
            await harness.shutdown();
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
            const opConfig = { _op: 'kafka_sender', api_name: 'kafka_sender_api', };
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
//# sourceMappingURL=schema-spec.js.map