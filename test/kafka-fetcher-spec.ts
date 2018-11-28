import 'jest-extended';
import uuidv4 from 'uuid/v4';
import { TestClientConfig, Logger } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaAdmin from './helpers/kafka-admin';
import Connector from '../packages/terafoundation_kafka_connector/dist';

describe('Kafka Reader', () => {
    jest.setTimeout(10 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(Object.assign(config, {
                brokers: ['localhost:9092'],
            }), logger, settings);
        }
    };

    const topic = uuidv4();
    const group = uuidv4();

    const clients = [clientConfig];

    const job = newTestJobConfig();
    job.operations = [
        {
            _op: 'teraslice_kafka_reader',
            topic,
            group
        },
        {
            _op: 'noop'
        }
    ];

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    const kafkaAdmin = new KafkaAdmin();

    beforeAll(async () => {
        jest.restoreAllMocks();
        await kafkaAdmin.ensureTopic(topic);
        await harness.initialize();
    });

    afterAll(async () => {
        jest.resetAllMocks();
        await harness.shutdown();
        await kafkaAdmin.deleteTopic(topic);
        await kafkaAdmin.close();
    });

    it('should return a list of records', async () => {
        const result = await harness.runSlice({});
        expect(result).toEqual([{}]);
    });
});
