import 'jest-extended';
import { TestClientConfig, Logger } from '@terascope/job-components';
import { SlicerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from '../packages/terafoundation_kafka_connector/dist';

jest.mock('../packages/terafoundation_kafka_connector/node_modules/node-rdkafka');

describe('KafkaSlicer', () => {
    const clientConfig: TestClientConfig = {
        type: 'kafka',
        endpoint: 'default',
        create(config: any, logger: Logger, settings: any) {
            // @ts-ignore
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
            clients
        });

        await harness.initialize();
    });

    afterEach(async () => {
        jest.resetAllMocks();
        await harness.shutdown();
    });

    it('should return empty slices', async () => {
        const slices = await harness.createSlices();
        expect(slices).toEqual([null]);
    });
});
