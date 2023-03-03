"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-unused-vars */
require("jest-extended");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const job_components_1 = require("@terascope/job-components");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const kafka_data_1 = require("../helpers/kafka-data");
const config_1 = require("../helpers/config");
const kafka_admin_1 = __importDefault(require("../helpers/kafka-admin"));
const testFetcherFile = path_1.default.join(__dirname, '../fixtures', 'test-fetcher-data.json');
const testFetcherData = (0, job_components_1.parseJSON)(fs_1.default.readFileSync(testFetcherFile));
describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);
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
    const topic = config_1.senderTopic;
    const clients = [clientConfig];
    const batchSize = 10;
    const targetRuns = 3;
    const targetSize = testFetcherData.length * targetRuns;
    const job = (0, teraslice_test_harness_1.newTestJobConfig)({
        max_retries: 3,
        operations: [
            {
                _op: 'test-reader',
                fetcher_data_file_path: testFetcherFile
            },
            {
                _op: 'kafka_sender',
                topic,
                size: batchSize,
                _dead_letter_action: 'log'
            }
        ],
    });
    const admin = new kafka_admin_1.default();
    let harness;
    let kafkaSender;
    let results = [];
    let consumed = [];
    let runs = 0;
    beforeAll(async () => {
        jest.clearAllMocks();
        await admin.ensureTopic(topic);
        harness = new teraslice_test_harness_1.WorkerTestHarness(job, {
            clients,
        });
        kafkaSender = harness.getOperation('kafka_sender');
        await harness.initialize();
        while (results.length < targetSize) {
            if (runs > targetRuns) {
                return;
            }
            runs++;
            const batch = await harness.runSlice({});
            results = results.concat(batch);
        }
        consumed = await (0, kafka_data_1.readData)(topic, results.length);
    });
    afterAll(async () => {
        jest.clearAllMocks();
        admin.disconnect();
        // it should be able to disconnect twice
        const shutdownList = [];
        for (const { sender } of kafkaSender.topicMap.values()) {
            shutdownList.push(sender.disconnect());
        }
        await Promise.all(shutdownList);
        await harness.shutdown();
    });
    it('should have produced the correct amount of records', () => {
        expect(consumed).toBeArrayOfSize(results.length);
        expect(job_components_1.DataEntity.isDataEntityArray(results)).toBeTrue();
        expect(results).toBeArrayOfSize(targetSize);
        expect(runs).toBe(targetRuns);
        for (let i = 0; i < results.length; i++) {
            const actual = consumed[i];
            const expected = results[i];
            expect(actual).toEqual(expected);
        }
    });
    it('should able to call _clientEvents without double listening', () => {
        const expectedTopic = kafkaSender.api;
        // @ts-expect-error
        const expected = expectedTopic.producer._client.listenerCount('error');
        expect(() => {
            const testTopic = kafkaSender.api;
            // @ts-expect-error
            testTopic.producer._clientEvents();
        }).not.toThrowError();
        const actualTopic = kafkaSender.api;
        // @ts-expect-error
        const actual = actualTopic.producer._client.listenerCount('error');
        expect(actual).toEqual(expected);
    });
    it('should call flush once per run and before the buffer is full', () => {
        const bufferSize = 1000000;
        const expected = runs + Math.floor(results.length / bufferSize);
        expect(mockFlush).toHaveBeenCalledTimes(expected);
    });
});
//# sourceMappingURL=processor-spec.js.map