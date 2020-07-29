import 'jest-extended';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import {
    TestClientConfig, Logger, APIFactoryRegistry, DataEntity, AnyObject
} from '@terascope/job-components';
import { KafkaSenderAPIConfig } from '../../asset/src/kafka_sender_api/interfaces';
import KafkaRouteSender from '../../asset/src/kafka_sender_api/sender';
import Connector from '../../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers, senderTopic } from '../helpers/config';
import KafkaAdmin from '../helpers/kafka-admin';
import { readData } from '../helpers/kafka-data';

type KafkaAPI = APIFactoryRegistry<KafkaRouteSender, KafkaSenderAPIConfig>;

describe('KafkaRouteSender', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();

    const admin = new KafkaAdmin();
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
        endpoint: 'default'
    };

    const clients = [kafkaConfig];
    const API_NAME = 'kafka_sender_api';

    const defaultConfigs = {
        _name: API_NAME,
        topic,

    };

    async function makeTest(apiConfig: AnyObject = {}) {
        const apiSender = Object.assign({}, defaultConfigs, apiConfig);
        const job = newTestJobConfig({
            apis: [apiSender],
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

        const api = harness.getAPI(API_NAME) as KafkaAPI;

        return api.create(topic, apiSender);
    }

    beforeAll(async () => admin.ensureTopic(topic));

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    afterAll(async () => {
        jest.clearAllMocks();
        admin.disconnect();
    });

    fit('can initialize', async () => {
        const sender = await makeTest();

        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();
    });

    // it('can send data to a topic', async () => {
    //     const sender = await makeTest();
    //     const obj1 = { hello: 'world' };
    //     const obj2 = { foo: 'bar' };

    //     const data = [
    //         DataEntity.make(obj1, { 'standard:route': topicMeta }),
    //         DataEntity.make(obj2, { 'standard:route': topicMeta })
    //     ];

    //     await sender.send(data);

    //     const topicResults = await readData(topic, 100);

    //     expect(topicResults).toBeArrayOfSize(2);
    // });

    // describe('->getKey', () => {
    //     let sender: KafkaRouteSender;

    //     beforeAll(async () => {
    //         sender = await makeTest();
    //     });

    //     describe('when id_field is set', () => {
    //         let ogIdField: string;

    //         beforeAll(() => {
    //             ogIdField = sender.config.id_field;
    //             sender.config.id_field = 'ip';
    //         });

    //         afterAll(() => {
    //             sender.config.id_field = ogIdField;
    //         });

    //         it('should return the key if the field exists', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             });

    //             // @ts-expect-error
    //             const key = sender.getKey(entity);

    //             expect(key).toEqual(entity.ip);
    //         });

    //         it('should return null if the key does not exist and no metadata', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             });

    //             // @ts-expect-error
    //             const key = sender.getKey(entity);

    //             expect(key).toBeNull();
    //         });

    //         it('should return null if the key exists but is not a string', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: 123,
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             });

    //             // @ts-expect-error
    //             const key = sender.getKey(entity);

    //             expect(key).toBeNull();
    //         });

    //         it('should return metadata _key if _key is present', () => {
    //             delete sender.config.id_field;

    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             }, { _key: 'someKey' });

    //             // @ts-expect-error
    //             const key = sender.getKey(entity);

    //             expect(key).toEqual('someKey');
    //         });

    //         it('should return opConfig.id_field, if specified', () => {
    //             sender.config.id_field = 'ip';

    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             }, { _key: 'someKey' });

    //             // @ts-expect-error
    //             const key = sender.getKey(entity);

    //             expect(key).toEqual(entity.ip);
    //         });
    //     });

    //     describe('when id_field is not set', () => {
    //         let ogIdField: string;

    //         beforeAll(() => {
    //             ogIdField = sender.config.id_field;
    //             sender.config.id_field = '';
    //         });

    //         afterAll(() => {
    //             sender.config.id_field = ogIdField;
    //         });

    //         it('should return null', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             });

    //             // @ts-expect-error
    //             const key = sender.getKey(entity);

    //             expect(key).toBeNull();
    //         });
    //     });
    // });

    // describe('->getRouteTopic', () => {
    //     describe('when "**" is not in the topic map', () => {
    //         let sender: KafkaRouteSender;

    //         beforeAll(async () => {
    //             sender = await makeTest({ _key: '*' });
    //         });

    //         it('returns null', () => {
    //             const entity = new DataEntity({
    //                 id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Luke Skywalker',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi'
    //             });

    //             // @ts-expect-error
    //             const routeTopic = sender.getRouteTopic(entity);
    //             expect(routeTopic).toEqual(null);
    //         });
    //     });

    //     describe('when "**" is in the topic map', () => {
    //         let sender: KafkaRouteSender;

    //         beforeAll(async () => {
    //             sender = await makeTest({ _key: '**' });
    //         });

    //         it('sets the topic based on the opConfig and the record\'s "standard:route"', () => {
    //             const entity = new DataEntity({
    //                 id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Luke Skywalker',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi'
    //             });
    //             entity.setMetadata('standard:route', 'endor');

    //             // @ts-expect-error
    //             const routeTopic = sender.getRouteTopic(entity);
    //             expect(routeTopic).toEqual(`${topic}-endor`);
    //         });

    //         it('sets the topic to default when missing record\'s "standard:route"', () => {
    //             const entity = new DataEntity({
    //                 id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Luke Skywalker',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi'
    //             });

    //             // @ts-expect-error
    //             const routeTopic = sender.getRouteTopic(entity);

    //             expect(routeTopic).toEqual(topic);
    //         });
    //     });
    // });

    // describe('->getTimestamp', () => {
    //     let sender: KafkaRouteSender;

    //     beforeAll(async () => {
    //         sender = await makeTest();
    //     });

    //     describe('when timestamp_field is set', () => {
    //         let ogTimestampField: string;

    //         beforeAll(() => {
    //             ogTimestampField = sender.config.timestamp_field;
    //             sender.config.timestamp_field = 'created';
    //         });

    //         afterAll(() => {
    //             sender.config.timestamp_field = ogTimestampField;
    //         });

    //         it('should return the key if the field exists', () => {
    //             const date = new Date();
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: date.toISOString()
    //             });

    //             // @ts-expect-error
    //             const time = sender.getTimestamp(entity);

    //             expect(time).toEqual(date.getTime());
    //         });

    //         it('should return null if the key does not exist', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //             });

    //             // @ts-expect-error
    //             const time = sender.getTimestamp(entity);

    //             expect(time).toBeNull();
    //         });

    //         it('should return null if the key exists but is not a Date', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'INVALID DATE'
    //             });

    //             // @ts-expect-error
    //             const time = sender.getTimestamp(entity);

    //             expect(time).toBeNull();
    //         });
    //     });

    //     describe('when timestamp_field is not set', () => {
    //         let ogTimestampField: string;

    //         beforeAll(() => {
    //             ogTimestampField = sender.config.timestamp_field;
    //             sender.config.timestamp_field = '';
    //         });

    //         afterAll(() => {
    //             sender.config.timestamp_field = ogTimestampField;
    //         });

    //         it('should return null', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: new Date().toISOString()
    //             });

    //             // @ts-expect-error
    //             const time = sender.getTimestamp(entity);

    //             expect(time).toBeNull();
    //         });
    //     });

    //     describe('when timestamp_now is set', () => {
    //         let ogTimestampNow: boolean;

    //         beforeAll(() => {
    //             ogTimestampNow = sender.config.timestamp_now;
    //             sender.config.timestamp_now = true;
    //         });

    //         afterAll(() => {
    //             sender.config.timestamp_now = ogTimestampNow;
    //         });

    //         it('should return the key if the field exists', () => {
    //             const entity = new DataEntity({
    //                 id: '7da04627-f786-5d1f-a18c-2735684efd3d',
    //                 name: 'Belle Parsons',
    //                 ip: '235.99.183.52',
    //                 url: 'http://bijupnag.cv/owi',
    //                 created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
    //             });

    //             // @ts-expect-error
    //             const time = sender.getTimestamp(entity);

    //             const now = Date.now();
    //             const start = now - 1000;
    //             const end = now + 1000;
    //             expect(time).toBeWithin(start, end);
    //         });
    //     });
    // });
});
