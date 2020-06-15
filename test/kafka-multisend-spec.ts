import 'jest-extended';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { readData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers, senderTopic } from './helpers/config';
import KafkaAdmin from './helpers/kafka-admin';

describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();
    const topicMeta1 = 'b';
    const topicMeta2 = 'F';
    const connectionEndpoint1 = 'kafka-1';
    const connectionEndpoint2 = 'kafka-2';

    const firstTopic = `${senderTopic}-${topicMeta1}`;
    const secondTopic = `${senderTopic}-${topicMeta2}`;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const connectorMap: Record<string, string> = {
        'a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p': connectionEndpoint1,
        'q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I': connectionEndpoint2,
        'J,K,L,M,O,P,Q,R,S,T,U,V,W,X,Y,Z,1,2,3,4,5,6,7,8,9,0,+,=': connectionEndpoint2
    };

    const kafkaConfig1: TestClientConfig = {
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
        endpoint: connectionEndpoint1
    };

    const kafkaConfig2: TestClientConfig = {
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
        endpoint: connectionEndpoint2
    };

    const topic = senderTopic;

    const clients = [kafkaConfig1, kafkaConfig2];
    const batchSize = 100;

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;

    async function makeTest(config = {}) {
        const kafkaConfig = Object.assign(
            {},
            {
                _op: 'kafka_sender',
                topic,
                size: batchSize,
                connection_map: connectorMap
            },
            config
        );

        const job = newTestJobConfig({
            max_retries: 3,
            operations: [
                {
                    _op: 'test-reader',
                    passthrough_slice: true
                },
                kafkaConfig
            ],
        });

        harness = new WorkerTestHarness(job, {
            clients,
        });

        await harness.initialize();

        return harness;
    }

    beforeEach(async () => {
        await Promise.all([
            admin.ensureTopic(firstTopic),
            admin.ensureTopic(secondTopic)
        ]);
    });

    afterEach(async () => {
        await harness.shutdown();
    });

    afterAll(async () => {
        jest.clearAllMocks();
        admin.disconnect();
    });

    it('can send to two topics', async () => {
        const obj1 = { hello: 'world' };
        const obj2 = { foo: 'bar' };

        const slice = [
            DataEntity.make(obj1, { 'standard:route': topicMeta1 }),
            DataEntity.make(obj2, { 'standard:route': topicMeta2 })
        ];

        const test = await makeTest();

        const results = await test.runSlice(slice);

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

    it('can throw if route is not set on record with default opConfig settings', async () => {
        const obj1 = { i: 'will fail' };
        const slice = [DataEntity.make(obj1)];

        const test = await makeTest();

        await expect(test.runSlice(slice)).rejects.toThrow('No route was specified in record metadata');
    });

    it('can throw if route is set on record but not in connector_map with no defaults with default opConfig settings', async () => {
        const obj1 = { i: 'will fail' };
        const route = 'iWillNotMatchAnything';
        const slice = [DataEntity.make(obj1, { 'standard:route': route })];

        const test = await makeTest();

        await expect(test.runSlice(slice)).rejects.toThrow(`Invalid connection route: ${route} was not found on connector_map`);
    });

    it('can ignore records (with no routes/ no connector_map match) setting opConfig _dead_letter_action to none', async () => {
        const obj1 = { i: 'will fail' };
        const route = 'iWillNotMatchAnything';
        const slice = [DataEntity.make(obj1, { 'standard:route': route })];

        const test = await makeTest({ _dead_letter_action: 'none' });

        const results = await test.runSlice(slice);

        expect(results).toEqual(slice);
    });
});
