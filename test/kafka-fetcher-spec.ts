import 'jest-extended';
import uuidv4 from 'uuid/v4';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaAdmin from './helpers/kafka-admin';
import { loadData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';

describe('Kafka Reader', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(Object.assign(config, {
                brokers: ['localhost:9092'],
            }), logger, settings);
        }
    };

    const topic = 'example-data-set';
    const group = uuidv4();

    const clients = [clientConfig];
    const size = 100;

    const job = newTestJobConfig();
    job.operations = [
        {
            _op: 'teraslice_kafka_reader',
            topic,
            group,
            size,
            wait: 500,
            bad_record_action: 'log'
        },
        {
            _op: 'noop'
        }
    ];

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    let exampleData: object[];
    let results: DataEntity[];

    const kafkaAdmin = new KafkaAdmin();

    beforeAll(async () => {
        jest.restoreAllMocks();

        await kafkaAdmin.ensureTopic(topic);

        // it should be able to call connect
        await harness.fetcher.consumer.connect();

        const [data] = await Promise.all([
            loadData(topic, 'example-data.txt'),
            harness.initialize()
        ]);

        exampleData = data;

        results = await harness.runSlice({});
    });

    afterAll(async () => {
        jest.resetAllMocks();

        // it should be able to disconnect twice
        await harness.fetcher.consumer.disconnect();

        await Promise.all([
            harness.shutdown(),
            kafkaAdmin.close(),
        ]);
    });

    it('should return a list of records', () => {
        expect(results).toBeArrayOfSize(size);
        expect(DataEntity.isDataEntityArray(results)).toBeTrue();

        for (let i = 0; i < size; i++) {
            const actual = results[i];
            const expected = exampleData[i];

            expect(DataEntity.isDataEntity(actual)).toBeTrue();
            expect(actual).toEqual(expected);
        }
    });
});
