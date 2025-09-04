import { jest } from '@jest/globals';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig, Logger } from '@terascope/job-components';
import Connector from 'terafoundation_kafka_connector';
import { KafkaSenderAPI } from '../../asset/src/kafka_sender_api/interfaces.js';
import { kafkaBrokers, senderTopic } from '../helpers/config.js';

describe('kafka_sender_api', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();
    const connection = 'default';
    const topicMeta = 'a';

    const topic = `${senderTopic}-${topicMeta}`;

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
    const API_NAME = 'kafka_sender_api';

    async function makeTest(apiConfig = { _name: API_NAME, topic: 'hello' }) {
        const job = newTestJobConfig({
            apis: [apiConfig],
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

        return harness.getAPI<KafkaSenderAPI>(API_NAME);
    }

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    it('can create the api', async () => {
        const test = await makeTest();

        expect(test.size).toBeDefined();
        expect(test.get).toBeDefined();
        expect(test.create).toBeDefined();
        expect(test.getConfig).toBeDefined();
        expect(test.remove).toBeDefined();
    });

    it('can create a sender', async () => {
        const test = await makeTest();

        expect(test.size).toEqual(0);

        const sender = await test.create(connection, { topic });

        expect(test.size).toEqual(1);

        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();

        const fetchedSender = test.get(connection);
        expect(fetchedSender).toBeDefined();
    });

    it('can create a sender using api topic', async () => {
        const test = await makeTest();

        expect(test.size).toEqual(0);

        const sender = await test.create(connection, {});

        expect(test.size).toEqual(1);

        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();

        const fetchedSender = test.get(connection);
        expect(fetchedSender).toBeDefined();
    });

    it('can create a sender with rdkafka_options', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello2',
            rdkafka_options: {
                'queue.buffering.max.kbytes': 540000
            }
        };
        const test = await makeTest(config);

        const sender = await test.create(connection, {});

        expect(sender.config.rdkafka_options).toEqual(config.rdkafka_options);

        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();

        const fetchedSender = test.get(connection);
        expect(fetchedSender).toBeDefined();
    });

    it('should throw when using invalid rdkafka_options key', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello2',
            rdkafka_options: {
                queue_buffering_max_kbytes: 540000
            }
        };
        const test = await makeTest(config);

        await expect(test.create(connection, {})).rejects.toThrow('No such configuration property: "queue_buffering_max_kbytes"');
    });

    it('should throw when using invalid rdkafka_options value', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello2',
            rdkafka_options: {
                'queue.buffering.max.kbytes': 'ten'
            }
        };
        const test = await makeTest(config);
        await expect(test.create(connection, {})).rejects.toThrow('Invalid value for configuration property "queue.buffering.max.kbytes"');
    });

    it('should default to empty object when setting rdkafka_options to non object', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello2',
            rdkafka_options: 'false'
        };
        const test = await makeTest(config);
        const sender = await test.create(connection, {});

        expect(sender.config.rdkafka_options).toEqual({});

        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();

        const fetchedSender = test.get(connection);
        expect(fetchedSender).toBeDefined();
    });
});
