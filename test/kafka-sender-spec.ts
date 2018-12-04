import 'jest-extended';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaSender from '../asset/src/kafka_sender/processor';
import KafkaAdmin from './helpers/kafka-admin';
import { readData } from './helpers/kafka-data';
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

    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'test-reader',
            },
            {
                _op: 'collect',
                wait: 100,
                size: 100
            },
            {
                _op: 'kafka_sender',
                topic,
            }
        ],
    });

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    const sender = harness.getOperation<KafkaSender>('kafka_sender');

    let results: DataEntity[] = [];
    let consumed: object[] = [];

    const kafkaAdmin = new KafkaAdmin();

    beforeAll(async () => {
        jest.restoreAllMocks();

        await kafkaAdmin.ensureTopic(topic);
        await harness.initialize();

        // it should be able to call connect
        await sender.producer.connect();
        results = await harness.runSlice({});
        consumed = await readData(topic, results.length);
    });

    afterAll(async () => {
        jest.resetAllMocks();

        // it should be able to disconnect twice
        await sender.producer.disconnect();

        await Promise.all([
            harness.shutdown(),
            kafkaAdmin.close(),
        ]);
    });

    it('should have produced the correct records', () => {
        expect(consumed).toBeArrayOfSize(results.length);
        expect(DataEntity.isDataEntityArray(results)).toBeTrue();

        for (let i = 0; i < results.length; i++) {
            const actual = consumed[i];
            const expected = results[i];

            expect(actual).toEqual(expected);
        }
    });
});
