import { jest } from '@jest/globals';
import 'jest-extended';
import { TestClientConfig } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import { SlicerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';

describe('Kafka Slicer', () => {
    const clientConfig: TestClientConfig = {
        type: 'kafka',
        createClient(config: any, logger: Logger, settings: any) {
            return Connector.createClient(config, logger, settings);
        }
    };

    const clients = [clientConfig];

    const job = newTestJobConfig({
        operations: [
            {
                _op: 'kafka_reader',
                api_name: 'kafka_reader_api'

            },
            {
                _op: 'noop'
            }
        ],
        apis: [
            {
                _name: 'kafka_reader_api',
                topic: 'test-123',
                group: 'test-456',
                _connection: 'default'
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
