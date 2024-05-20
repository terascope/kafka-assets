import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig, Logger } from '@terascope/job-components';
import Connector from 'terafoundation_kafka_connector';
import { KafkaSenderAPI } from '../../asset/src/kafka_sender_api/interfaces';
import { kafkaBrokers, senderTopic } from '../helpers/config';

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

    async function makeTest() {
        const job = newTestJobConfig({
            apis: [{ _name: API_NAME, topic: 'hello' }],
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
});
