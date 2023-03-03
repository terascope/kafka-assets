"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
describe('Kafka Slicer', () => {
    const clientConfig = {
        type: 'kafka',
        create(config, logger, settings) {
            return terafoundation_kafka_connector_1.default.create(config, logger, settings);
        }
    };
    const clients = [clientConfig];
    const job = (0, teraslice_test_harness_1.newTestJobConfig)({
        operations: [
            {
                _op: 'kafka_reader',
                topic: 'test-123',
                group: 'test-456',
                connection: 'default'
            },
            {
                _op: 'noop'
            }
        ]
    });
    let harness;
    beforeEach(async () => {
        jest.restoreAllMocks();
        harness = new teraslice_test_harness_1.SlicerTestHarness(job, {
            clients,
        });
        await harness.initialize();
    });
    afterEach(async () => {
        jest.resetAllMocks();
        await harness.shutdown();
    });
    it('should return empty slices', async () => {
        const slices = await harness.createSlices();
        expect(slices).toEqual([{}]);
    });
    it('should have a maxQueueLength of workers + 1', () => {
        const slicer = harness.slicer();
        harness.setWorkers(5);
        expect(slicer.maxQueueLength()).toEqual(6);
        harness.setWorkers(2);
        expect(slicer.maxQueueLength()).toEqual(3);
    });
});
//# sourceMappingURL=slicer-spec.js.map