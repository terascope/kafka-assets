import 'jest-extended';
import path from 'path';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaAdmin from './helpers/kafka-admin';
import Connector from '../packages/terafoundation_kafka_connector/dist';

describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: ['localhost:9092'],
        },
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const topic = 'example-sender-data-set';

    const clients = [clientConfig];

    const fetcherDataFilePath = path.join(__dirname, 'fixtures', 'test-reader-data.json');

    // @ts-ignore
    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'test-reader',
                fetcherDataFilePath,
            },
            {
                _op: 'teraslice_kafka_sender',
                topic,
            }
        ],
    });

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    let results: DataEntity[] = [];

    const kafkaAdmin = new KafkaAdmin();

    beforeAll(async () => {
        jest.restoreAllMocks();

        await kafkaAdmin.ensureTopic(topic);
        await harness.initialize();

        // it should be able to call connect
        await harness.processors[0].producer.connect();

        results = await harness.runSlice({});
    });

    afterAll(async () => {
        jest.resetAllMocks();

        // it should be able to disconnect twice
        await harness.processors[0].producer.disconnect();

        await Promise.all([
            harness.shutdown(),
            kafkaAdmin.close(),
        ]);
    });

    it('should return a list of records', () => {
        // TODO
        expect(results).toBeArrayOfSize(results.length);
        expect(DataEntity.isDataEntityArray(results)).toBeTrue();
    });

    it('should have produced the results', async () => {
        // TODO
        expect(true).toBeTrue();
    });
});
