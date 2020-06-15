import 'jest-extended';
import path from 'path';
import {
    TestClientConfig,
    Logger,
    DataEntity,
    NoopProcessor,
} from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { readData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers, deadLetterTopic } from './helpers/config';
import KafkaAdmin from './helpers/kafka-admin';

const testFetcherFile = path.join(__dirname, 'fixtures', 'test-fetcher-data.json');

describe('Kafka Dead Letter', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const topic = deadLetterTopic;

    const clients = [clientConfig];

    const badRecords = [
        Buffer.from('bad buffer'),
        'bad string',
        { bad: 'object' },
        DataEntity.make({ bad: 'entity' }),
        null,
    ];

    const job = newTestJobConfig({
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

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;
    let noop: NoopProcessor;
    let consumed: Record<string, any>[] = [];

    beforeAll(async () => {
        jest.restoreAllMocks();

        await admin.ensureTopic(topic);

        harness = new WorkerTestHarness(job, {
            clients,
        });

        noop = harness.getOperation('noop');

        noop.onBatch = async (batch: DataEntity[]) => {
            for (const record of badRecords) {
                const err = new Error('Uh no!');
                noop.rejectRecord(record, err);
            }
            return batch;
        };

        await harness.initialize();

        await harness.runSlice({});

        consumed = await readData(topic, badRecords.length);
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
