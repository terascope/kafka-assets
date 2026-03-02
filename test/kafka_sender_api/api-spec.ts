import { jest } from '@jest/globals';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { TestClientConfig } from '@terascope/job-components';
import { Logger } from '@terascope/core-utils';
import Connector from 'terafoundation_kafka_connector';
import { KafkaSenderAPI } from '../../asset/src/kafka_sender_api/interfaces.js';
import { kafkaBrokers, senderTopic } from '../helpers/config.js';

describe('kafka_sender_api', () => {
    jest.setTimeout(15 * 1000);
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

    it('can create a sender with max_buffer_size', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            max_buffer_size: 50000
        };
        const test = await makeTest(config);
        const sender = await test.create(connection, {});
        expect(sender).toBeDefined();
    });

    it('can create a sender with max_buffer_kbytes_size', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            max_buffer_kbytes_size: 1000
        };
        const test = await makeTest(config);
        const sender = await test.create(connection, {});
        expect(sender).toBeDefined();
    });

    it('appends _key to topic when _key is not a wildcard', async () => {
        const test = await makeTest();
        const sender = await test.create(connection, { _key: 'region' });
        expect(sender.config.topic).toEqual('hello-region');
    });

    it('uses topic as-is when _key is **', async () => {
        const test = await makeTest();
        const sender = await test.create(connection, { _key: '**' });
        expect(sender.config.topic).toEqual('hello');
    });

    it('can remove an existing sender', async () => {
        const test = await makeTest();

        await test.create(connection, {});
        expect(test.size).toEqual(1);

        await test.remove(connection);
        expect(test.size).toEqual(0);
    });

    it('remove with a non-existent key is a no-op', async () => {
        const test = await makeTest();
        await expect(test.remove('nonexistent')).resolves.toBeUndefined();
    });

    it('should throw when setting rdkafka_options to non object', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello2',
            rdkafka_options: 'false'
        };
        await expect(makeTest(config)).rejects.toThrow('Invalid parameter rdkafka_options, it must be an object');
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

    it('should warn when dr_cb is enabled with required_acks set to 0', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            required_acks: 0,
            rdkafka_options: { dr_cb: true }
        };
        const test = await makeTest(config);
        const sender = await test.create(connection, {});
        expect(sender).toBeDefined();
    });

    it('should warn when dr_msg_cb is enabled with required_acks set to 0', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            required_acks: 0,
            rdkafka_options: { dr_msg_cb: true }
        };
        const test = await makeTest(config);
        const sender = await test.create(connection, {});
        expect(sender).toBeDefined();
    });

    it('should throw when delivery_report is set but dr_cb and dr_msg_cb are both false', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            delivery_report: { wait: true, error_only: false, on_error: 'log' },
            rdkafka_options: { dr_cb: false, dr_msg_cb: false }
        };
        const test = await makeTest(config);
        await expect(test.create(connection, {})).rejects.toThrow(
            'Parameter delivery_report is set but neither the `dr_cb` or `dr_msg_cb`'
        );
    });

    it('should throw when delivery_report.on_error is throw but wait is false', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            delivery_report: { wait: false, error_only: false, on_error: 'throw' },
            rdkafka_options: { dr_cb: true }
        };
        const test = await makeTest(config);
        await expect(test.create(connection, {})).rejects.toThrow(
            'If parameter delivery_report.on_error is `throw` then delivery_report.wait must be `true`'
        );
    });

    it('should throw when delivery_report.error_only is true but wait is also true', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            delivery_report: { wait: true, error_only: true, on_error: 'log' },
            rdkafka_options: { dr_cb: true }
        };
        const test = await makeTest(config);
        await expect(test.create(connection, {})).rejects.toThrow(
            'If parameter delivery_report.error_only is `true` then delivery_report.wait must be `false`'
        );
    });

    it('should throw when both delivery_report.error_only and rdkafka delivery.report.only.error are set', async () => {
        const config = {
            _name: API_NAME,
            topic: 'hello',
            delivery_report: { wait: false, error_only: false, on_error: 'log' },
            rdkafka_options: { dr_cb: true, 'delivery.report.only.error': true }
        };
        const test = await makeTest(config);
        await expect(test.create(connection, {})).rejects.toThrow(
            'If parameter delivery_report.error_only is set then `delivery.report.only.error`'
        );
    });

    describe('validateConfig field validation via per-create overrides', () => {
        it('should throw if topic is not a string', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { topic: 123 as any }))
                .rejects.toThrow('Parameter topic must be provided and be of type string');
        });

        it('should throw if _connection is not a string', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { _connection: 123 as any }))
                .rejects.toThrow('Parameter _connection must be provided and be of type string');
        });

        it('should throw if size is not a number', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { size: 'big' as any }))
                .rejects.toThrow('Parameter size must be provided and be of type number');
        });

        it('should throw if max_buffer_size is a non-number', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { max_buffer_size: 'big' as any }))
                .rejects.toThrow('Parameter max_buffer_size must be either undefined or be of type number');
        });

        it('should throw if id_field is a non-null non-string', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { id_field: 123 as any }))
                .rejects.toThrow('Parameter id_field must be provided and be of type string');
        });

        it('should throw if timestamp_field is a non-null non-string', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { timestamp_field: 123 as any }))
                .rejects.toThrow('Parameter timestamp_field must be provided and be of type string');
        });

        it('should throw if timestamp_now is a non-null non-boolean', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { timestamp_now: 'yes' as any }))
                .rejects.toThrow('Parameter timestamp_now must be provided and be of type string');
        });

        it('should throw if compression is not a string', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { compression: 123 as any }))
                .rejects.toThrow('Parameter compression must be provided and be of type string');
        });

        it('should throw if wait is not a number', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { wait: 'long' as any }))
                .rejects.toThrow('Parameter wait must be provided and be of type number');
        });

        it('should throw if metadata_refresh is not a number', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { metadata_refresh: 'often' as any }))
                .rejects.toThrow('Parameter metadata_refresh must be provided and be of type number');
        });

        it('should throw if required_acks is not a number', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { required_acks: 'all' as any }))
                .rejects.toThrow('Parameter required_acks must be provided and be of type number');
        });

        it('should throw if rdkafka_options is not an object', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { rdkafka_options: 'opts' as any }))
                .rejects.toThrow('Parameter rdkafka_options must be provided and be of type Object');
        });

        it('should throw if delivery_report.wait is not a boolean', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { delivery_report: { wait: 'yes', error_only: false, on_error: 'log' } as any }))
                .rejects.toThrow('Parameter delivery_report.wait must be provided and be of type boolean');
        });

        it('should throw if delivery_report.error_only is not a boolean', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { delivery_report: { wait: true, error_only: 'yes', on_error: 'log' } as any }))
                .rejects.toThrow('Parameter delivery_report.error_only must be provided and be of type boolean');
        });

        it('should throw if delivery_report.on_error is not a valid value', async () => {
            const test = await makeTest();
            await expect(test.create(connection, { delivery_report: { wait: true, error_only: false, on_error: 'bad' } as any }))
                .rejects.toThrow('Parameter delivery_report.on_error must be provided and be one of');
        });
    });
});
