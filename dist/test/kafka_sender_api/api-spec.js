"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const config_1 = require("../helpers/config");
describe('kafka_sender_api', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();
    const connection = 'default';
    const topicMeta = 'h';
    const topic = `${config_1.senderTopic}-${topicMeta}`;
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
    const API_NAME = 'kafka_sender_api';
    async function makeTest() {
        const job = (0, teraslice_test_harness_1.newTestJobConfig)({
            apis: [{ _name: API_NAME, topic: 'hello' }],
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
        return harness.getAPI(API_NAME);
    }
    afterEach(async () => {
        if (harness)
            await harness.shutdown();
    });
    it('can create the api', async () => {
        const test = await makeTest();
        expect(test.size).toBeDefined();
        expect(test.get).toBeDefined();
        expect(test.create).toBeDefined();
        expect(test.getConfig).toBeDefined();
        expect(test.remove).toBeDefined();
    });
    it('can create a sender', async () => {
        const test = await makeTest();
        expect(test.size).toEqual(0);
        const sender = await test.create(connection, { topic });
        expect(test.size).toEqual(1);
        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();
        const fetchedSender = test.get(connection);
        expect(fetchedSender).toBeDefined();
    });
    it('can create a sender using api topic', async () => {
        const test = await makeTest();
        expect(test.size).toEqual(0);
        const sender = await test.create(connection, {});
        expect(test.size).toEqual(1);
        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();
        const fetchedSender = test.get(connection);
        expect(fetchedSender).toBeDefined();
    });
});
//# sourceMappingURL=api-spec.js.map