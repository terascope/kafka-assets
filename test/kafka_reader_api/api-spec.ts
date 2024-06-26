import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig, Logger } from '@terascope/job-components';
import Connector from 'terafoundation_kafka_connector';
import { DEFAULT_API_NAME, KafkaReaderAPI } from '../../asset/src/kafka_reader_api/interfaces.js';
import { kafkaBrokers, fetcherAPITopic, fetcherGroup } from '../helpers/config.js';
import { loadData } from '../helpers/kafka-data.js';
import KafkaAdmin from '../helpers/kafka-admin.js';

describe('kafka_reader_api', () => {
    jest.setTimeout(30 * 1000);

    const mockFlush = jest.fn();
    const connection = 'default';

    const topic = fetcherAPITopic;
    const group = fetcherGroup;
    const apiName = DEFAULT_API_NAME;

    let exampleData: Record<string, any>[];

    let harness: WorkerTestHarness;

    const kafkaConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        async createClient(config: any, logger: Logger, settings: any) {
            const result = await Connector.createClient(config, logger, settings);
            // @ts-expect-error
            result.client.flush = mockFlush
                // @ts-expect-error
                .mockImplementation(result.client.flush)
                .bind(result.client);
            return result;
        },
        endpoint: connection
    };

    const clients = [kafkaConfig];

    async function makeTest() {
        const job = newTestJobConfig({
            apis: [{
                _name: apiName,
                topic,
                group,
                rollback_on_failure: true,
                _dead_letter_action: 'log'
            }],
            operations: [
                {
                    _op: 'test-reader',
                    passthrough_slice: true
                },
                {
                    _op: 'noop'
                }
            ]
        });

        harness = new WorkerTestHarness(job, { clients });

        await harness.initialize();

        return harness.getAPI<KafkaReaderAPI>(apiName);
    }

    const admin = new KafkaAdmin();

    beforeAll(async () => {
        await admin.ensureTopic(topic);
        exampleData = await loadData(topic, 'example-data.txt');
    });

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    afterAll(async () => {
        jest.resetAllMocks();
        admin.disconnect();
    });

    it('can create the factory api', async () => {
        const apiManager = await makeTest();

        expect(apiManager.size).toBeDefined();
        expect(apiManager.get).toBeDefined();
        expect(apiManager.create).toBeDefined();
        expect(apiManager.getConfig).toBeDefined();
        expect(apiManager.remove).toBeDefined();
    });

    it('can read data', async () => {
        const apiManager = await makeTest();
        const client = await apiManager.create('test', {});
        const config = apiManager.getConfig('test');

        if (!config) throw new Error('config is supposed to be present');

        expect(client).toBeDefined();
        expect(apiManager.size).toEqual(1);

        const results = await client.consume({ size: exampleData.length, wait: config.wait });

        expect(results.length).toEqual(exampleData.length);
    });
});
