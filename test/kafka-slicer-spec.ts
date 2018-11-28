import 'jest-extended';
import { TestClientConfig, Logger } from '@terascope/job-components';
import { SlicerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from '../packages/terafoundation_kafka_connector';

jest.mock('node-rdkafka');

describe('KafkaSlicer', () => {
    const clientConfig: TestClientConfig = {
        type: 'kafka',
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const clients = [clientConfig];

    const job = newTestJobConfig();
    job.operations = [
        {
            _op: 'teraslice_kafka_reader',
            topic: 'test-123',
            group: 'test-456',
            connection: 'default'
        },
        {
            _op: 'noop'
        }
    ];

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

    it('should have a maxQueueLength of workers * 2', () => {
        harness.setWorkers(5);
        expect(harness.slicer.maxQueueLength()).toEqual(10);
    });
});
