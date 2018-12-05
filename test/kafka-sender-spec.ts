import 'jest-extended';
import uuidv4 from 'uuid/v4';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaSender from '../asset/src/kafka_sender/processor';
import { readData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers } from './helpers/config';

describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const topic = `kafka-test-send-${uuidv4()}`;

    const clients = [clientConfig];
    const batchSize = 200;

    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'test-reader',
            },
            {
                _op: 'kafka_sender',
                topic,
                wait: 1000,
                size: batchSize
            }
        ],
    });

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    const sender = harness.getOperation<KafkaSender>('kafka_sender');

    let results: DataEntity[] = [];
    let consumed: object[] = [];
    let runs = 0;

    beforeAll(async () => {
        jest.restoreAllMocks();

        await harness.initialize();

        // it should be able to call connect
        await sender.producer.connect();

        while (results.length !== batchSize) {
            if (++runs > 5) {
                throw new Error(`Expected to resolve a batch size of ${batchSize}, got ${results.length}`);
            }
            const batch = await harness.runSlice({});
            results = results.concat(batch);
        }

        consumed = await readData(topic, results.length);
    });

    afterAll(async () => {
        jest.resetAllMocks();

        // it should be able to disconnect twice
        await sender.producer.disconnect();
        await harness.shutdown();
    });

    it('should have produced the correct records', () => {
        expect(consumed).toBeArrayOfSize(results.length);
        expect(DataEntity.isDataEntityArray(results)).toBeTrue();
        expect(results).toBeArrayOfSize(batchSize);
        expect(runs).toBe(2);

        for (let i = 0; i < results.length; i++) {
            const actual = consumed[i];
            const expected = results[i];

            expect(actual).toEqual(expected);
        }
    });

    describe('->getKey', () => {
        describe('when id_field is set', () => {
            // @ts-ignore
            const ogIdField = sender.opConfig.id_field;
            beforeAll(() => {
                // @ts-ignore
                sender.opConfig.id_field = 'ip';
            });

            afterAll(() => {
                // @ts-ignore
                sender.opConfig.id_field = ogIdField;
            });

            it('should return the key if the field exists', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-ignore
                const key = sender.getKey(entity);

                expect(key).toEqual(entity.ip);
            });

            it('should return null if the key does not exist', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-ignore
                const key = sender.getKey(entity);

                expect(key).toBeNull();
            });

            it('should return null if the key exists but is not a string', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: 123,
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-ignore
                const key = sender.getKey(entity);

                expect(key).toBeNull();
            });
        });

        describe('when id_field is not set', () => {
            // @ts-ignore
            const ogIdField = sender.opConfig.id_field;
            beforeAll(() => {
                // @ts-ignore
                sender.opConfig.id_field = '';
            });

            afterAll(() => {
                // @ts-ignore
                sender.opConfig.id_field = ogIdField;
            });

            it('should return null', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-ignore
                const key = sender.getKey(entity);

                expect(key).toBeNull();
            });
        });
    });

    describe('->getTimestamp', () => {
        describe('when timestamp_field is set', () => {
            // @ts-ignore
            const ogTimestampField = sender.opConfig.timestamp_field;
            beforeAll(() => {
                // @ts-ignore
                sender.opConfig.timestamp_field = 'created';
            });

            afterAll(() => {
                // @ts-ignore
                sender.opConfig.timestamp_field = ogTimestampField;
            });

            it('should return the key if the field exists', () => {
                const date = new Date();
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: date.toISOString()
                });

                // @ts-ignore
                const time = sender.getTimestamp(entity);

                expect(time).toEqual(date.getTime());
            });

            it('should return null if the key does not exist', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                });

                // @ts-ignore
                const time = sender.getTimestamp(entity);

                expect(time).toBeNull();
            });

            it('should return null if the key exists but is not a Date', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'INVALID DATE'
                });

                // @ts-ignore
                const time = sender.getTimestamp(entity);

                expect(time).toBeNull();
            });
        });

        describe('when timestamp_field is not set', () => {
            // @ts-ignore
            const ogTimestampField = sender.opConfig.timestamp_field;
            beforeAll(() => {
                // @ts-ignore
                sender.opConfig.timestamp_field = '';
            });

            afterAll(() => {
                // @ts-ignore
                sender.opConfig.timestamp_field = ogTimestampField;
            });

            it('should return null', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: new Date().toISOString()
                });

                // @ts-ignore
                const time = sender.getTimestamp(entity);

                expect(time).toBeNull();
            });
        });

        describe('when timestamp_now is set', () => {
            // @ts-ignore
            const ogTimestampNow = sender.opConfig.timestamp_now;
            beforeAll(() => {
                // @ts-ignore
                sender.opConfig.timestamp_now = true;
            });

            afterAll(() => {
                // @ts-ignore
                sender.opConfig.timestamp_now = ogTimestampNow;
            });

            it('should return the key if the field exists', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-ignore
                const time = sender.getTimestamp(entity);

                const now = Date.now();
                const start = now - 1000;
                const end = now + 1000;
                expect(time).toBeWithin(start, end);
            });
        });
    });
});
