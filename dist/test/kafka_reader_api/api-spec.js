"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const interfaces_1 = require("../../asset/src/kafka_reader_api/interfaces");
const config_1 = require("../helpers/config");
const kafka_data_1 = require("../helpers/kafka-data");
const kafka_admin_1 = __importDefault(require("../helpers/kafka-admin"));
describe('kafka_reader_api', () => {
    jest.setTimeout(30 * 1000);
    const mockFlush = jest.fn();
    const connection = 'default';
    const topic = config_1.fetcherAPITopic;
    const group = config_1.fetcherGroup;
    const apiName = interfaces_1.DEFAULT_API_NAME;
    let exampleData;
    let harness;
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
        endpoint: connection
    };
    const clients = [kafkaConfig];
    async function makeTest() {
        const job = (0, teraslice_test_harness_1.newTestJobConfig)({
            apis: [{
                    _name: apiName,
                    topic,
                    group,
                    rollback_on_failure: true,
                    _dead_letter_action: 'log'
                }],
            operations: [
                {
                    _op: 'test-reader',
                    passthrough_slice: true
                },
                {
                    _op: 'noop'
                }
            ]
        });
        harness = new teraslice_test_harness_1.WorkerTestHarness(job, { clients });
        await harness.initialize();
        return harness.getAPI(apiName);
    }
    const admin = new kafka_admin_1.default();
    beforeAll(async () => {
        await admin.ensureTopic(topic);
        exampleData = await (0, kafka_data_1.loadData)(topic, 'example-data.txt');
    });
    afterEach(async () => {
        if (harness)
            await harness.shutdown();
    });
    afterAll(async () => {
        jest.resetAllMocks();
        admin.disconnect();
    });
    it('can create the factory api', async () => {
        const apiManager = await makeTest();
        expect(apiManager.size).toBeDefined();
        expect(apiManager.get).toBeDefined();
        expect(apiManager.create).toBeDefined();
        expect(apiManager.getConfig).toBeDefined();
        expect(apiManager.remove).toBeDefined();
    });
    it('can read data', async () => {
        const apiManager = await makeTest();
        const client = await apiManager.create('test', {});
        const config = apiManager.getConfig('test');
        if (!config)
            throw new Error('config is supposed to be present');
        expect(client).toBeDefined();
        expect(apiManager.size).toEqual(1);
        const results = await client.consume({ size: exampleData.length, wait: config.wait });
        expect(results.length).toEqual(exampleData.length);
    });
});
//# sourceMappingURL=api-spec.js.map