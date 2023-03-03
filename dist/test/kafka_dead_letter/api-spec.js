"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const path_1 = __importDefault(require("path"));
const job_components_1 = require("@terascope/job-components");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const kafka_data_1 = require("../helpers/kafka-data");
const config_1 = require("../helpers/config");
const kafka_admin_1 = __importDefault(require("../helpers/kafka-admin"));
const testFetcherFile = path_1.default.join(__dirname, '../fixtures', 'test-fetcher-data.json');
describe('Kafka Dead Letter', () => {
    jest.setTimeout(15 * 1000);
    const clientConfig = {
        type: 'kafka',
        config: {
            brokers: config_1.kafkaBrokers,
        },
        create(config, logger, settings) {
            return terafoundation_kafka_connector_1.default.create(config, logger, settings);
        }
    };
    const topic = config_1.deadLetterTopic;
    const clients = [clientConfig];
    const badRecords = [
        Buffer.from('bad buffer'),
        'bad string',
        { bad: 'object' },
        job_components_1.DataEntity.make({ bad: 'entity' }),
        null,
    ];
    const job = (0, teraslice_test_harness_1.newTestJobConfig)({
        max_retries: 3,
        apis: [
            {
                _name: 'kafka_dead_letter',
                topic,
                size: 1,
                wait: 20,
            }
        ],
        operations: [
            {
                _op: 'test-reader',
                fetcher_data_file_path: testFetcherFile
            },
            {
                _op: 'noop',
                _dead_letter_action: 'kafka_dead_letter'
            }
        ],
    });
    const admin = new kafka_admin_1.default();
    let harness;
    let noop;
    let consumed = [];
    beforeAll(async () => {
        jest.restoreAllMocks();
        await admin.ensureTopic(topic);
        harness = new teraslice_test_harness_1.WorkerTestHarness(job, {
            clients,
        });
        noop = harness.getOperation('noop');
        noop.onBatch = async (batch) => {
            for (const record of badRecords) {
                const err = new Error('Uh no!');
                noop.rejectRecord(record, err);
            }
            return batch;
        };
        await harness.initialize();
        await harness.runSlice({});
        consumed = await (0, kafka_data_1.readData)(topic, badRecords.length);
    });
    afterAll(async () => {
        jest.resetAllMocks();
        admin.disconnect();
        await harness.shutdown();
    });
    it('should have produced all of the bad records', () => {
        expect(consumed).toBeArrayOfSize(badRecords.length);
        for (const expected of consumed) {
            expect(expected).toHaveProperty('error');
            expect(expected).toHaveProperty('record');
        }
    });
});
//# sourceMappingURL=api-spec.js.map