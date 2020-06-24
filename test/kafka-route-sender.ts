// import {} from
// import KafkaSenderApi from '../asset/src/kafka_sender_api/api';
// import KafkaRouteSender from '../asset/src/kafka_sender_api/kafka-route-sender';
// import Connector from '../packages/terafoundation_kafka_connector/dist';

// describe('KafkaRouteSender', () => {

//     const client = Connector.create(config, logger, settings);
//     // @ts-expect-error
//     result.client.flush = mockFlush
//         // @ts-expect-error
//         .mockImplementation(result.client.flush)
//         .bind(result.client);
//     return result;
//     async function makeTest() {
//         const sender = new KafkaRouteSender();
//     }

//     it('can load', () => {

//     });

//     describe('->getKey', () => {
//         describe('when id_field is set', () => {
//             let ogIdField: string;

//             beforeAll(() => {
//                 ogIdField = sender.opConfig.id_field;
//                 // @ts-expect-error
//                 sender.opConfig.id_field = 'ip';
//             });

//             afterAll(() => {
//                 // @ts-expect-error
//                 sender.opConfig.id_field = ogIdField;
//             });

//             it('should return the key if the field exists', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 });

//                 // @ts-expect-error
//                 const key = sender.getKey(entity);

//                 expect(key).toEqual(entity.ip);
//             });

//             it('should return null if the key does not exist and no metadata', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 });

//                 // @ts-expect-error
//                 const key = sender.getKey(entity);

//                 expect(key).toBeNull();
//             });

//             it('should return null if the key exists but is not a string', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: 123,
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 });

//                 // @ts-expect-error
//                 const key = sender.getKey(entity);

//                 expect(key).toBeNull();
//             });

//             it('should return metadata _key if _key is present', () => {
//                 // @ts-expect-error
//                 delete sender.opConfig.id_field;

//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 }, { _key: 'someKey' });

//                 // @ts-expect-error
//                 const key = sender.getKey(entity);

//                 expect(key).toEqual('someKey');
//             });

//             it('should return opConfig.id_field, if specified', () => {
//                 // @ts-expect-error
//                 sender.opConfig.id_field = 'ip';

//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 }, { _key: 'someKey' });

//                 // @ts-expect-error
//                 const key = sender.getKey(entity);

//                 expect(key).toEqual(entity.ip);
//             });
//         });

//         describe('when id_field is not set', () => {
//             let ogIdField: string;

//             beforeAll(() => {
//                 ogIdField = sender.opConfig.id_field;

//                 // @ts-expect-error
//                 sender.opConfig.id_field = '';
//             });

//             afterAll(() => {
//                 // @ts-expect-error
//                 sender.opConfig.id_field = ogIdField;
//             });

//             it('should return null', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 });

//                 // @ts-expect-error
//                 const key = sender.getKey(entity);

//                 expect(key).toBeNull();
//             });
//         });
//     });

//     describe('->getRouteTopic', () => {
//         describe('when "**" is not in the topic map', () => {
//             let ogTopicMap: Map<string, any>;

//             beforeAll(() => {
//                 ogTopicMap = sender.topicMap;

//                 sender.topicMap = new Map();
//                 // @ts-expect-error
//                 sender.topicMap.set('*', {});
//             });

//             afterAll(() => {
//                 sender.topicMap = ogTopicMap;
//             });
//             it('returns null', () => {
//                 const entity = new DataEntity({
//                     id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Luke Skywalker',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi'
//                 });
//                 // @ts-expect-error
//                 const routeTopic = sender.getRouteTopic(entity);
//                 expect(routeTopic).toEqual(null);
//             });
//         });
//         describe('when "**" is in the topic map', () => {
//             let ogTopicMap: Map<string, any>;

//             beforeAll(() => {
//                 ogTopicMap = sender.topicMap;

//                 sender.topicMap = new Map();
//                 // @ts-expect-error
//                 sender.topicMap.set('**', {});
//             });

//             afterAll(() => {
//                 sender.topicMap = ogTopicMap;
//             });
//             it('sets the topic based on the opConfig and the record\'s "standard:route"', () => {
//                 const entity = new DataEntity({
//                     id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Luke Skywalker',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi'
//                 });
//                 entity.setMetadata('standard:route', 'endor');
//                 // @ts-expect-error
//                 const routeTopic = sender.getRouteTopic(entity, '**');
//                 expect(routeTopic).toEqual('kafka-test-sender-endor');
//             });
//             it('sets the topic to default when missing record\'s "standard:route"', () => {
//                 const entity = new DataEntity({
//                     id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Luke Skywalker',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi'
//                 });
//                 // @ts-expect-error
//                 const routeTopic = sender.getRouteTopic(entity, '**');
//                 expect(routeTopic).toEqual('kafka-test-sender');
//             });
//         });
//     });

//     describe('->getTimestamp', () => {
//         describe('when timestamp_field is set', () => {
//             let ogTimestampField: string;

//             beforeAll(() => {
//                 ogTimestampField = sender.opConfig.timestamp_field;

//                 // @ts-expect-error
//                 sender.opConfig.timestamp_field = 'created';
//             });

//             afterAll(() => {
//                 // @ts-expect-error
//                 sender.opConfig.timestamp_field = ogTimestampField;
//             });

//             it('should return the key if the field exists', () => {
//                 const date = new Date();
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: date.toISOString()
//                 });

//                 // @ts-expect-error
//                 const time = sender.getTimestamp(entity);

//                 expect(time).toEqual(date.getTime());
//             });

//             it('should return null if the key does not exist', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                 });

//                 // @ts-expect-error
//                 const time = sender.getTimestamp(entity);

//                 expect(time).toBeNull();
//             });

//             it('should return null if the key exists but is not a Date', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'INVALID DATE'
//                 });

//                 // @ts-expect-error
//                 const time = sender.getTimestamp(entity);

//                 expect(time).toBeNull();
//             });
//         });

//         describe('when timestamp_field is not set', () => {
//             let ogTimestampField: string;

//             beforeAll(() => {
//                 ogTimestampField = sender.opConfig.timestamp_field;
//                 // @ts-expect-error
//                 sender.opConfig.timestamp_field = '';
//             });

//             afterAll(() => {
//                 // @ts-expect-error
//                 sender.opConfig.timestamp_field = ogTimestampField;
//             });

//             it('should return null', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: new Date().toISOString()
//                 });

//                 // @ts-expect-error
//                 const time = sender.getTimestamp(entity);

//                 expect(time).toBeNull();
//             });
//         });

//         describe('when timestamp_now is set', () => {
//             let ogTimestampNow: boolean;

//             beforeAll(() => {
//                 ogTimestampNow = sender.opConfig.timestamp_now;
//                 // @ts-expect-error
//                 sender.opConfig.timestamp_now = true;
//             });

//             afterAll(() => {
//                 // @ts-expect-error
//                 sender.opConfig.timestamp_now = ogTimestampNow;
//             });

//             it('should return the key if the field exists', () => {
//                 const entity = new DataEntity({
//                     id: '7da04627-f786-5d1f-a18c-2735684efd3d',
//                     name: 'Belle Parsons',
//                     ip: '235.99.183.52',
//                     url: 'http://bijupnag.cv/owi',
//                     created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
//                 });

//                 // @ts-expect-error
//                 const time = sender.getTimestamp(entity);

//                 const now = Date.now();
//                 const start = now - 1000;
//                 const end = now + 1000;
//                 expect(time).toBeWithin(start, end);
//             });
//         });
//     });
// });
