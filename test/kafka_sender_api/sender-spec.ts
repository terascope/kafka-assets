import { jest } from '@jest/globals';
import 'jest-extended';
import { execSync } from 'node:child_process';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig, APIFactoryRegistry } from '@terascope/job-components';
import { DataEntity, pDelay } from '@terascope/core-utils';
import Connector from 'terafoundation_kafka_connector';
import { KafkaSenderAPIConfig } from '../../asset/src/kafka_sender_api/interfaces.js';
import KafkaRouteSender from '../../asset/src/kafka_sender_api/sender.js';
import { connectorConfig, encryptKafka, kafkaPort, senderTopic } from '../helpers/config.js';
import KafkaAdmin from '../helpers/kafka-admin.js';
import { readData } from '../helpers/kafka-data.js';
import { KafkaConnectorConfig, KafkaProducerSettings, KafkaProducerResult } from 'terafoundation_kafka_connector/src/interfaces.js';

type KafkaAPI = APIFactoryRegistry<KafkaRouteSender, KafkaSenderAPIConfig>;

describe('KafkaRouteSender', () => {
    jest.setTimeout(15 * 1000);

    const admin = new KafkaAdmin();
    const topicMeta = 'h';
    const topic = `${senderTopic}-${topicMeta}`;

    let harness: WorkerTestHarness;
    let producerMetadataCalls = 0;

    const kafkaConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            ...connectorConfig,
        },
        async createClient(config, logger, settings) {
            const result = await Connector.createClient(
                config as KafkaConnectorConfig,
                logger,
                settings as unknown as KafkaProducerSettings
            ) as KafkaProducerResult;
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

    async function makeTest(apiConfig: Partial<KafkaSenderAPIConfig> = {}) {
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

        const sender = await api.create(topic, apiSender);

        sender.producer.getMetadata = async (): Promise<void> => {
            producerMetadataCalls += 1;
        };

        return sender;
    }

    beforeAll(async () => admin.ensureTopic(topic));

    afterEach(async () => {
        producerMetadataCalls = 0;
        if (harness) await harness.shutdown();
    });

    afterAll(async () => {
        admin.disconnect();
    });

    it('can initialize', async () => {
        const sender = await makeTest();

        expect(sender.send).toBeDefined();
        expect(sender.verify).toBeDefined();
    });

    it('verify will only check if route is not in cache', async () => {
        const sender = await makeTest();
        sender.producer.doesTopicExist = async (): Promise<boolean> => {
            return true;
        };
        expect(producerMetadataCalls).toEqual(0);

        await sender.verify('something');
        expect(producerMetadataCalls).toEqual(1);

        await sender.verify('something');
        expect(producerMetadataCalls).toEqual(1);
    });

    // Run for both strategies to ensure produceV1 (threshold_flush) and
    // produceV2 (retry_on_full) both correctly deliver messages end-to-end.
    // The topic runs 'ensureTopic' between iterations because readData starts from
    // offset 0 with a fresh consumer group, so previous iterations' messages
    // would inflate the count.
    it.each([
        { strategy: 'threshold_flush' as const },
        { strategy: 'retry_on_full' as const }
    ])('can send data to a topic ($strategy)', async ({ strategy }) => {
        await admin.ensureTopic(topic);
        const sender = await makeTest({ queue_backpressure_strategy: strategy });
        const obj1 = { hello: 'world' };
        const obj2 = { foo: 'bar' };

        const data = [
            DataEntity.make(obj1, { 'standard:route': topicMeta }),
            DataEntity.make(obj2, { 'standard:route': topicMeta })
        ];

        await sender.send(data);

        const topicResults = await readData(topic, 100);

        expect(topicResults).toBeArrayOfSize(2);
    });

    it('verify throws error when topic does not exist', async () => {
        const sender = await makeTest();
        sender.producer.doesTopicExist = async (): Promise<boolean> => {
            return false;
        };

        await expect(sender.verify('nonexistent'))
            .rejects.toThrow(`Topic ${topic}-nonexistent does not exist and could not be created.`);
    });

    it('send calls verify for non-routed_sender operations', async () => {
        const sender = await makeTest();
        let verifyCalled = false;
        const originalVerify = sender.verify.bind(sender);

        sender.verify = async (route?: string): Promise<void> => {
            verifyCalled = true;
            // Mock doesTopicExist to return true so verify completes successfully
            sender.producer.doesTopicExist = async (): Promise<boolean> => true;
            return originalVerify(route);
        };

        const data = [DataEntity.make({ hello: 'world' })];
        await sender.send(data);

        expect(verifyCalled).toBe(true);
    });

    it('send does not call verify when _op is routed_sender', async () => {
        const sender = await makeTest({ _op: 'routed_sender' });
        let verifyCalled = false;

        sender.verify = async (): Promise<void> => {
            verifyCalled = true;
        };

        const data = [DataEntity.make({ hello: 'world' })];
        await sender.send(data);

        expect(verifyCalled).toBe(false);
    });

    describe('->getKey', () => {
        let sender: KafkaRouteSender;

        beforeAll(async () => {
            sender = await makeTest();
        });

        describe('when id_field is set', () => {
            let ogIdField: string;

            beforeAll(() => {
                ogIdField = sender.config.id_field;
                sender.config.id_field = 'ip';
            });

            afterAll(() => {
                sender.config.id_field = ogIdField;
            });

            it('should return the key if the field exists', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-expect-error
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

                // @ts-expect-error
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

                // @ts-expect-error
                const key = sender.getKey(entity);

                expect(key).toBeNull();
            });

            it('should return metadata _key if _key is present', () => {
                delete sender.config.id_field;

                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                }, { _key: 'someKey' });

                // @ts-expect-error
                const key = sender.getKey(entity);

                expect(key).toEqual('someKey');
            });

            it('should return opConfig.id_field, if specified', () => {
                sender.config.id_field = 'ip';

                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                }, { _key: 'someKey' });

                // @ts-expect-error
                const key = sender.getKey(entity);

                expect(key).toEqual(entity.ip);
            });
        });

        describe('when id_field is not set', () => {
            let ogIdField: string;

            beforeAll(() => {
                ogIdField = sender.config.id_field;
                sender.config.id_field = '';
            });

            afterAll(() => {
                sender.config.id_field = ogIdField;
            });

            it('should return null', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-expect-error
                const key = sender.getKey(entity);

                expect(key).toBeNull();
            });
        });
    });

    describe('->getRouteTopic', () => {
        describe('when "**" is not in the topic map', () => {
            let sender: KafkaRouteSender;

            beforeAll(async () => {
                sender = await makeTest({ _key: '*' });
            });

            it('returns null', () => {
                const entity = new DataEntity({
                    id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
                    name: 'Luke Skywalker',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi'
                });

                // @ts-expect-error
                const routeTopic = sender.getRouteTopic(entity);
                expect(routeTopic).toEqual(null);
            });
        });

        describe('when "**" is in the topic map', () => {
            let sender: KafkaRouteSender;

            beforeAll(async () => {
                sender = await makeTest({ _key: '**' });
            });

            it('sets the topic based on the opConfig and the record\'s "standard:route"', () => {
                const entity = new DataEntity({
                    id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
                    name: 'Luke Skywalker',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi'
                });
                entity.setMetadata('standard:route', 'endor');

                // @ts-expect-error
                const routeTopic = sender.getRouteTopic(entity);
                expect(routeTopic).toEqual(`${topic}-endor`);
            });

            it('sets the topic to default when missing record\'s "standard:route"', () => {
                const entity = new DataEntity({
                    id: '7dab1337-f786-5d1f-a18c-2735684efd3d',
                    name: 'Luke Skywalker',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi'
                });

                // @ts-expect-error
                const routeTopic = sender.getRouteTopic(entity);

                expect(routeTopic).toEqual(topic);
            });
        });
    });

    describe('->getTimestamp', () => {
        let sender: KafkaRouteSender;

        beforeAll(async () => {
            sender = await makeTest();
        });

        describe('when timestamp_field is set', () => {
            let ogTimestampField: string;

            beforeAll(() => {
                ogTimestampField = sender.config.timestamp_field;
                sender.config.timestamp_field = 'created';
            });

            afterAll(() => {
                sender.config.timestamp_field = ogTimestampField;
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

                // @ts-expect-error
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

                // @ts-expect-error
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

                // @ts-expect-error
                const time = sender.getTimestamp(entity);

                expect(time).toBeNull();
            });
        });

        describe('when timestamp_field is not set', () => {
            let ogTimestampField: string;

            beforeAll(() => {
                ogTimestampField = sender.config.timestamp_field;
                sender.config.timestamp_field = '';
            });

            afterAll(() => {
                sender.config.timestamp_field = ogTimestampField;
            });

            it('should return null', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: new Date().toISOString()
                });

                // @ts-expect-error
                const time = sender.getTimestamp(entity);

                expect(time).toBeNull();
            });
        });

        describe('when timestamp_now is set', () => {
            let ogTimestampNow: boolean;

            beforeAll(() => {
                ogTimestampNow = sender.config.timestamp_now;
                sender.config.timestamp_now = true;
            });

            afterAll(() => {
                sender.config.timestamp_now = ogTimestampNow;
            });

            it('should return the key if the field exists', () => {
                const entity = new DataEntity({
                    id: '7da04627-f786-5d1f-a18c-2735684efd3d',
                    name: 'Belle Parsons',
                    ip: '235.99.183.52',
                    url: 'http://bijupnag.cv/owi',
                    created: 'Tue May 15 2046 18:37:21 GMT-0700 (Mountain Standard Time)'
                });

                // @ts-expect-error
                const time = sender.getTimestamp(entity);

                const now = Date.now();
                const start = now - 1000;
                const end = now + 1000;
                expect(time).toBeWithin(start, end);
            });
        });
    });

    // Run delivery-report tests for both produce implementations:
    // - produceV1 is used when queue_backpressure_strategy is 'threshold_flush' (default)
    // - produceV2 is used when queue_backpressure_strategy is 'retry_on_full'
    // The delivery-report handling code is shared, but describe.each ensures both
    // produce code paths are exercised with every delivery-report scenario.
    describe.each([
        { strategy: 'threshold_flush' as const },
        { strategy: 'retry_on_full' as const }
    ])('delivery-reports ($strategy)', ({ strategy }) => {
        const kafkaConfigsCmd = `docker exec ts_test_kafka /opt/kafka/bin/kafka-configs.sh  --bootstrap-server localhost:${kafkaPort}`
            + (encryptKafka ? ' --command-config /tmp/kafka-ssl.properties' : '');

        beforeAll(() => {
            if (encryptKafka) {
                execSync(`docker exec ts_test_kafka bash -c "printf 'security.protocol=SSL\\nssl.truststore.type=PEM\\nssl.truststore.location=/etc/kafka/secrets/CAs/rootCA.pem\\nssl.keystore.type=PEM\\nssl.keystore.location=/etc/kafka/secrets/kafka-keypair.pem\\n' > /tmp/kafka-ssl.properties"`);
            }
        });

        let loggerDebugSpy: any;
        let loggerErrorSpy: any;
        afterEach(() => {
            if (loggerDebugSpy) {
                loggerDebugSpy.mockRestore();
            }
            if (loggerErrorSpy) {
                loggerErrorSpy.mockRestore();
            }
        });

        it('can throw on delivery report errors', async () => {
            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter --add-config producer_byte_rate=1');

            const sender = await makeTest(
                {
                    topic,
                    queue_backpressure_strategy: strategy,
                    delivery_report: {
                        wait: true,
                        waitTimeout: 10000,
                        only_error: false,
                        on_error: 'throw'
                    },
                    rdkafka_options: {
                        dr_cb: true,
                        'message.timeout.ms': 2000,
                        'request.timeout.ms': 5000,
                        'socket.timeout.ms': 5000,
                        retries: 0,
                        'retry.backoff.ms': 100,
                        'linger.ms': 0,
                        'batch.num.messages': 1
                    }
                }
            );

            const obj1 = { hello: 'world' };

            const data = [];
            for (let i = 0; i < 2; i++) {
                data.push(DataEntity.make(obj1, { 'standard:route': topicMeta }));
            }

            const promise = sender.send(data);

            try {
                await promise;
                throw new Error('Promise should not have resolved');
            } catch (err) {
                expect(err).toHaveProperty(
                    'message',
                    expect.stringContaining('Delivery-report: error received:')
                );
            } finally {
                execSync(kafkaConfigsCmd
                    + ' --entity-type clients --entity-default --alter  --delete-config producer_byte_rate');
            }
        });

        it('can ignore delivery-report errors', async () => {
            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter --add-config producer_byte_rate=1');
            const sender = await makeTest(
                {
                    topic,
                    queue_backpressure_strategy: strategy,
                    delivery_report: {
                        wait: true,
                        waitTimeout: 10000,
                        only_error: false,
                        on_error: 'ignore'
                    },
                    rdkafka_options: {
                        dr_cb: true,
                        'message.timeout.ms': 2000,
                        'request.timeout.ms': 5000,
                        'socket.timeout.ms': 5000,
                        retries: 0,
                        'retry.backoff.ms': 100,
                        'linger.ms': 0,
                        'batch.num.messages': 1
                    }
                }
            );

            const obj1 = { hello: 'world' };

            const data = [];
            for (let i = 0; i < 2; i++) {
                data.push(DataEntity.make(obj1, { 'standard:route': topicMeta }));
            }

            loggerDebugSpy = jest.spyOn(sender.logger, 'debug');
            loggerErrorSpy = jest.spyOn(sender.logger, 'error');
            await sender.send(data);

            expect(loggerErrorSpy).not.toHaveBeenCalled();
            expect(loggerDebugSpy).toHaveBeenLastCalledWith(
                'Delivery-report: all 2 reports received for batchNumber 1. Stats: {"received":2,"errors":1,"expected":2}'
            );

            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter  --delete-config producer_byte_rate');
        });

        it('eventually logs all reports received if `wait` is false', async () => {
            const sender = await makeTest({
                queue_backpressure_strategy: strategy,
                delivery_report: {
                    wait: false,
                    only_error: false,
                    on_error: 'log'
                },
                rdkafka_options: {
                    dr_cb: true
                }
            });
            const obj1 = { hello: 'world' };
            const obj2 = { foo: 'bar' };

            const data = [
                DataEntity.make(obj1, { 'standard:route': topicMeta }),
                DataEntity.make(obj2, { 'standard:route': topicMeta })
            ];

            loggerDebugSpy = jest.spyOn(sender.logger, 'debug');

            await sender.send(data);
            await sender.send(data);

            await pDelay(500);

            expect(loggerDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('Delivery-report: all 2 reports received for batch 1')
            );
            expect(loggerDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('Delivery-report: all 2 reports received for batch 2')
            );
            expect(sender.producer.deliveryReportStats).toEqual({});
        });

        it('will not wait for reports if `wait` is false', async () => {
            const sender = await makeTest({
                queue_backpressure_strategy: strategy,
                delivery_report: {
                    wait: false,
                    only_error: false,
                    on_error: 'log'
                },
                rdkafka_options: {
                    dr_cb: true
                }
            });
            const obj1 = { hello: 'world' };
            const obj2 = { foo: 'bar' };

            const data = [
                DataEntity.make(obj1, { 'standard:route': topicMeta }),
                DataEntity.make(obj2, { 'standard:route': topicMeta })
            ];

            loggerDebugSpy = jest.spyOn(sender.logger, 'debug');

            await sender.send(data);
            expect(loggerDebugSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('Delivery-report: all 2 reports received for batch 1')
            );

            await sender.send(data);
            expect(loggerDebugSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('Delivery-report: all 2 reports received for batch 2')
            );
        });

        it('wait for and log all reports if wait is `true`', async () => {
            const sender = await makeTest({
                queue_backpressure_strategy: strategy,
                delivery_report: {
                    wait: true,
                    waitTimeout: 10000,
                    only_error: false,
                    on_error: 'log'
                },
                rdkafka_options: {
                    dr_cb: true
                }
            });
            const obj1 = { hello: 'world' };
            const obj2 = { foo: 'bar' };

            const data = [
                DataEntity.make(obj1, { 'standard:route': topicMeta }),
                DataEntity.make(obj2, { 'standard:route': topicMeta })
            ];

            loggerDebugSpy = jest.spyOn(sender.logger, 'debug');

            await sender.send(data);

            expect(loggerDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('Delivery-report: all 2 reports received for batchNumber 1')
            );

            await sender.send(data);
            expect(loggerDebugSpy).toHaveBeenCalledWith(
                expect.stringContaining('Delivery-report: all 2 reports received for batchNumber 2')
            );
            expect(sender.producer.deliveryReportStats).toEqual({});
        });

        it('logs errors and completes when wait is true and on_error is log', async () => {
            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter --add-config producer_byte_rate=1');

            const sender = await makeTest(
                {
                    topic,
                    queue_backpressure_strategy: strategy,
                    delivery_report: {
                        wait: true,
                        waitTimeout: 10000,
                        only_error: false,
                        on_error: 'log'
                    },
                    rdkafka_options: {
                        dr_cb: true,
                        'message.timeout.ms': 2000,
                        'request.timeout.ms': 5000,
                        'socket.timeout.ms': 5000,
                        retries: 0,
                        'retry.backoff.ms': 100,
                        'linger.ms': 0,
                        'batch.num.messages': 1
                    }
                }
            );

            const data = [];
            for (let i = 0; i < 2; i++) {
                data.push(DataEntity.make({ hello: 'world' }, { 'standard:route': topicMeta }));
            }

            loggerErrorSpy = jest.spyOn(sender.logger, 'error');
            loggerDebugSpy = jest.spyOn(sender.logger, 'debug');

            try {
                await sender.send(data);

                expect(loggerErrorSpy).toHaveBeenCalled();
                expect(loggerDebugSpy).toHaveBeenCalledWith(
                    expect.stringContaining('Delivery-report: all 2 reports received for batchNumber 1')
                );
            } finally {
                execSync(kafkaConfigsCmd
                    + ' --entity-type clients --entity-default --alter  --delete-config producer_byte_rate');
            }
        });

        it('rejects with timeout error when waitTimeout is exceeded', async () => {
            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter --add-config producer_byte_rate=1');

            const sender = await makeTest(
                {
                    topic,
                    queue_backpressure_strategy: strategy,
                    delivery_report: {
                        wait: true,
                        waitTimeout: 1,
                        only_error: false,
                        on_error: 'log'
                    },
                    rdkafka_options: {
                        dr_cb: true,
                        'message.timeout.ms': 5000,
                        'request.timeout.ms': 10000,
                        'socket.timeout.ms': 10000,
                        retries: 0,
                        'retry.backoff.ms': 100,
                        'linger.ms': 0,
                        'batch.num.messages': 1
                    }
                }
            );

            const obj1 = { hello: 'world' };

            const data = [];
            for (let i = 0; i < 20; i++) {
                data.push(DataEntity.make(obj1, { 'standard:route': topicMeta }));
            }

            try {
                await expect(sender.send(data)).rejects.toThrow(
                    /^Delivery-report: waitTimeout exceeded for batch 1:/
                );
            } finally {
                execSync(kafkaConfigsCmd
                    + ' --entity-type clients --entity-default --alter  --delete-config producer_byte_rate');
            }
        });

        it('logs errors from delivery reports when wait is false and on_error is log', async () => {
            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter --add-config producer_byte_rate=1');

            const sender = await makeTest(
                {
                    topic,
                    queue_backpressure_strategy: strategy,
                    delivery_report: {
                        wait: false,
                        only_error: false,
                        on_error: 'log'
                    },
                    rdkafka_options: {
                        dr_cb: true,
                        'message.timeout.ms': 2000,
                        'request.timeout.ms': 5000,
                        'socket.timeout.ms': 5000,
                        retries: 0,
                        'retry.backoff.ms': 100,
                        'linger.ms': 0,
                        'batch.num.messages': 1
                    }
                }
            );

            const data = [];
            for (let i = 0; i < 2; i++) {
                data.push(DataEntity.make({ hello: 'world' }, { 'standard:route': topicMeta }));
            }

            loggerErrorSpy = jest.spyOn(sender.logger, 'error');

            try {
                await sender.send(data);
                await pDelay(6000);

                expect(loggerErrorSpy).toHaveBeenCalled();
                expect(loggerErrorSpy).toHaveBeenCalledWith(
                    expect.any(Error),
                    expect.stringContaining('"standard:route":"h"')
                );
            } finally {
                execSync(kafkaConfigsCmd
                    + ' --entity-type clients --entity-default --alter  --delete-config producer_byte_rate');
            }
        });

        it('ignores errors from delivery reports when wait is false and on_error is ignore', async () => {
            execSync(kafkaConfigsCmd
                + ' --entity-type clients --entity-default --alter --add-config producer_byte_rate=1');

            const sender = await makeTest(
                {
                    topic,
                    queue_backpressure_strategy: strategy,
                    delivery_report: {
                        wait: false,
                        only_error: false,
                        on_error: 'ignore'
                    },
                    rdkafka_options: {
                        dr_cb: true,
                        'message.timeout.ms': 2000,
                        'request.timeout.ms': 5000,
                        'socket.timeout.ms': 5000,
                        retries: 0,
                        'retry.backoff.ms': 100,
                        'linger.ms': 0,
                        'batch.num.messages': 1
                    }
                }
            );

            const data = [];
            for (let i = 0; i < 2; i++) {
                data.push(DataEntity.make({ hello: 'world' }, { 'standard:route': topicMeta }));
            }

            loggerErrorSpy = jest.spyOn(sender.logger, 'error');

            try {
                await sender.send(data);
                await pDelay(6000);

                expect(loggerErrorSpy).not.toHaveBeenCalled();
            } finally {
                execSync(kafkaConfigsCmd
                    + ' --entity-type clients --entity-default --alter  --delete-config producer_byte_rate');
            }
        });
    });
});
