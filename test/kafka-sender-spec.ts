import 'jest-extended';
import fs from 'fs';
import path from 'path';
import {
    TestClientConfig, Logger, DataEntity, parseJSON
} from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaSender from '../asset/src/kafka_sender/processor';
import { readData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';
import { kafkaBrokers, senderTopic } from './helpers/config';
import KafkaAdmin from './helpers/kafka-admin';

const testFetcherFile = path.join(__dirname, 'fixtures', 'test-fetcher-data.json');
const testFetcherData: object[] = parseJSON(fs.readFileSync(testFetcherFile));

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

    const topic = senderTopic;

    const clients = [clientConfig];
    const batchSize = 10;
    const targetRuns = 3;
    const targetSize = testFetcherData.length * targetRuns;

    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'test-reader',
                fetcher_data_file_path: testFetcherFile
            },
            {
                _op: 'kafka_sender',
                topic,
                size: batchSize
            }
        ],
    });

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;
    let sender: KafkaSender;
    let results: DataEntity[] = [];
    let consumed: object[] = [];
    let runs = 0;

    beforeAll(async () => {
        jest.restoreAllMocks();

        await admin.ensureTopic(topic);

        harness = new WorkerTestHarness(job, {
            clients,
        });

        // FIXME: using "as any" is hack, we should properly fix it
        sender = harness.getOperation('kafka_sender') as any;

        await harness.initialize();

        // it should be able to call connect again
        await sender.producer.connect();

        while (results.length < targetSize) {
            if (runs > targetRuns) {
                return;
            }
            runs++;
            const batch = await harness.runSlice({});
            results = results.concat(batch);
        }

        consumed = await readData(topic, results.length);
    });

    afterAll(async () => {
        jest.resetAllMocks();

        admin.disconnect();

        // it should be able to disconnect twice
        await sender.producer.disconnect();
        await harness.shutdown();
    });

    it('should able to call _clientEvents without double listening', () => {
        // @ts-ignore
        const expected = sender.producer._client.listenerCount('error');

        expect(() => {
            // @ts-ignore
            sender.producer._clientEvents();
        }).not.toThrowError();

        // @ts-ignore
        const actual = sender.producer._client.listenerCount('error');

        expect(actual).toEqual(expected);
    });

    it('should have produced the correct amount of records', () => {
        expect(consumed).toBeArrayOfSize(results.length);
        expect(DataEntity.isDataEntityArray(results)).toBeTrue();
        expect(results).toBeArrayOfSize(targetSize);
        expect(runs).toBe(targetRuns);

        for (let i = 0; i < results.length; i++) {
            const actual = consumed[i];
            const expected = results[i];

            expect(actual).toEqual(expected);
        }
    });

    describe('->getKey', () => {
        describe('when id_field is set', () => {
            let ogIdField: string;

            beforeAll(() => {
                // @ts-ignore
                ogIdField = sender.opConfig.id_field;
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

            it('should return null if the key does not exist and no metadata', () => {
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

            it('should return metadata _key if _key is present', () => {
                // @ts-ignore
                delete sender.opConfig.id_field;

                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                }, { _key: 'someKey' });

                // @ts-ignore
                const key = sender.getKey(entity);

                expect(key).toEqual('someKey');
            });

            it('should return opConfig.id_field, if specified', () => {
                // @ts-ignore
                sender.opConfig.id_field = 'ip';

                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                }, { _key: 'someKey' });

                // @ts-ignore
                const key = sender.getKey(entity);

                expect(key).toEqual(entity.ip);
            });
        });

        describe('when id_field is not set', () => {
            let ogIdField: string;

            beforeAll(() => {
                // @ts-ignore
                ogIdField = sender.opConfig.id_field;

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
            let ogTimestampField: string;

            beforeAll(() => {
                // @ts-ignore
                ogTimestampField = sender.opConfig.timestamp_field;

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
            let ogTimestampField: string;

            beforeAll(() => {
                // @ts-ignore
                ogTimestampField = sender.opConfig.timestamp_field;
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
            let ogTimestampNow: boolean;

            beforeAll(() => {
                // @ts-ignore
                ogTimestampNow = sender.opConfig.timestamp_now;
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
