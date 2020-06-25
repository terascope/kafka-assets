import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig, Logger, APIFactoryRegistry } from '@terascope/job-components';
import { KafkaSenderAPIConfig } from '../asset/src/kafka_sender_api/interfaces';

import KafkaRouteSender from '../asset/src/kafka_sender_api/kafka-route-sender';

import Connector from '../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers, senderTopic } from './helpers/config';

type KafkaAPI = APIFactoryRegistry<KafkaRouteSender, KafkaSenderAPIConfig>;

describe('kafak-sender-api', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();
    const connection = 'default';
    const topicMeta = 'h';

    const topic = `${senderTopic}-${topicMeta}`;

    let harness: WorkerTestHarness;

    const kafkaConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            const result = Connector.create(config, logger, settings);
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
            apis: [{ _name: API_NAME }],
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
        // @ts-expect-error
        return harness.getOperationAPI(API_NAME) as KafkaAPI;
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
});
