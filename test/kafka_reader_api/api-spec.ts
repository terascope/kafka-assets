import { jest } from '@jest/globals';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import Connector from 'terafoundation_kafka_connector';
import { KafkaReaderAPI } from '../../asset/src/kafka_reader_api/interfaces.js';
import { kafkaBrokers, fetcherAPITopic, fetcherGroup } from '../helpers/config.js';
import { loadData } from '../helpers/kafka-data.js';
import KafkaAdmin from '../helpers/kafka-admin.js';

describe('kafka_reader_api', () => {
    jest.setTimeout(30 * 1000);

    const mockFlush = jest.fn();
    const connection = 'default';

    const topic = fetcherAPITopic;
    const group = fetcherGroup;
    const apiName = 'kafka_reader_api';

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

    async function makeTest(apiConfig?: any) {
        const config = apiConfig
            ? apiConfig
            : {
                _name: apiName,
                topic,
                group,
                rollback_on_failure: true,
                _dead_letter_action: 'log'
            };

        const job = newTestJobConfig({
            apis: [config],
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

    it('can configure with valid rdkafka_options', async () => {
        const apiConfig = {
            _name: apiName,
            topic,
            group,
            rollback_on_failure: true,
            _dead_letter_action: 'log',
            rdkafka_options: {
                'queued.max.messages.kbytes': 100000
            }
        };

        const apiManager = await makeTest(apiConfig);
        const client = await apiManager.create('test', {});
        const config = apiManager.getConfig('test');

        if (!config) throw new Error('config is supposed to be present');

        expect(config.rdkafka_options).toEqual(apiConfig.rdkafka_options);
        expect(client).toBeDefined();
        expect(apiManager.size).toEqual(1);

        const results = await client.consume({ size: exampleData.length, wait: config.wait });

        expect(results.length).toEqual(exampleData.length);
    });

    it('should throw with invalid rdkafka_options key', async () => {
        const apiConfig = {
            _name: apiName,
            topic,
            group,
            rollback_on_failure: true,
            _dead_letter_action: 'log',
            rdkafka_options: {
                queued_max_messages_kbytes: 100000
            }
        };

        const apiManager = await makeTest(apiConfig);
        await expect(apiManager.create('test', {})).rejects.toThrow('No such configuration property: "queued_max_messages_kbytes"');
    });

    it('should throw with invalid rdkafka_options value', async () => {
        const apiConfig = {
            _name: apiName,
            topic,
            group,
            rollback_on_failure: true,
            _dead_letter_action: 'log',
            rdkafka_options: {
                'queued.max.messages.kbytes': 'a lot'
            }
        };

        const apiManager = await makeTest(apiConfig);
        await expect(apiManager.create('test', {})).rejects.toThrow('Invalid value for configuration property "queued.max.messages.kbytes"');
    });

    it('should default to empty object when setting rdkafka_options to non object', async () => {
        const apiConfig = {
            _name: apiName,
            topic,
            group,
            rollback_on_failure: true,
            _dead_letter_action: 'log',
            rdkafka_options: false
        };

        const apiManager = await makeTest(apiConfig);
        const client = await apiManager.create('test', {});
        const config = apiManager.getConfig('test');

        if (!config) throw new Error('config is supposed to be present');

        expect(config.rdkafka_options).toEqual({});
        expect(client).toBeDefined();
        expect(apiManager.size).toEqual(1);

        const results = await client.consume({ size: exampleData.length, wait: config.wait });

        expect(results.length).toEqual(exampleData.length);
    });
});
