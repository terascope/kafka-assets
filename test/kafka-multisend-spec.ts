import 'jest-extended';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaSender from '../asset/src/kafka_sender/processor';
import { readData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers, senderTopic } from './helpers/config';
import KafkaAdmin from './helpers/kafka-admin';

describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();
    const topicMeta1 = 'billy';
    const topicMeta2 = 'fred';
    const connectionEndpoint2 = 'kafka-2';

    const firstTopic = `${senderTopic}-${topicMeta1}`;
    const secondTopic = `${senderTopic}-${topicMeta2}`;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const connectorMap: Record<string, string> = {
        [topicMeta1]: 'default',
        [topicMeta2]: connectionEndpoint2
    };

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            const result = Connector.create(config, logger, settings);
            // @ts-ignore
            result.client.flush = mockFlush
                // @ts-ignore
                .mockImplementation(result.client.flush)
                .bind(result.client);
            return result;
        },
        endpoint: 'default'
    };

    const clientConfig2: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            const result = Connector.create(config, logger, settings);
            // @ts-ignore
            result.client.flush = mockFlush
                // @ts-ignore
                .mockImplementation(result.client.flush)
                .bind(result.client);
            return result;
        },
        endpoint: connectionEndpoint2
    };

    const topic = senderTopic;

    const clients = [clientConfig, clientConfig2];
    const batchSize = 100;

    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'test-reader',
            },
            {
                _op: 'kafka_sender',
                topic,
                size: batchSize,
                connection_map: connectorMap
            }
        ],
    });

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;
    let sender: KafkaSender;
    let input: DataEntity[] = [];

    beforeAll(async () => {
        jest.clearAllMocks();

        await Promise.all([
            admin.ensureTopic(firstTopic),
            admin.ensureTopic(secondTopic)
        ]);

        harness = new WorkerTestHarness(job, {
            clients,
        });

        harness.fetcher().handle = async () => input;

        sender = harness.getOperation('kafka_sender') as any;

        await harness.initialize();

        const initList = [];

        for (const [, { producer }] of Object.entries(sender.topicMap)) {
            initList.push(producer.connect());
        }

        await Promise.all(initList);
    });

    afterAll(async () => {
        jest.clearAllMocks();

        admin.disconnect();

        // it should be able to disconnect twice
        const shutdownList = [];

        for (const [, { producer }] of Object.entries(sender.topicMap)) {
            shutdownList.push(producer.disconnect());
        }

        await Promise.all(shutdownList);
        await harness.shutdown();
    });

    it('can send to two topics', async () => {
        const obj1 = { hello: 'world' };
        const obj2 = { foo: 'bar' };

        input = [
            DataEntity.make(obj1, { 'standard:route': topicMeta1 }),
            DataEntity.make(obj2, { 'standard:route': topicMeta2 })
        ];

        const results = await harness.runSlice({});

        expect(results).toBeArrayOfSize(2);

        const [topic1, topic2] = await Promise.all([
            readData(firstTopic, 100),
            readData(secondTopic, 100)
        ]);

        expect(topic1).toBeArrayOfSize(1);
        expect(topic1[0]).toEqual(obj1);

        expect(topic2).toBeArrayOfSize(1);
        expect(topic2[0]).toEqual(obj2);
    });
});
