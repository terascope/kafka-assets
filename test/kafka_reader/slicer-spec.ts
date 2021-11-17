import 'jest-extended';
import { TestClientConfig, Logger } from '@terascope/job-components';
import { SlicerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';

describe('Kafka Slicer', () => {
    const clientConfig: TestClientConfig = {
        type: 'kafka',
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const clients = [clientConfig];

    const job = newTestJobConfig({
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

    let harness: SlicerTestHarness;

    beforeEach(async () => {
        jest.restoreAllMocks();

        harness = new SlicerTestHarness(job, {
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
