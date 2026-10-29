import { jest } from '@jest/globals';
import 'jest-extended';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestClientConfig, NoopProcessor } from '@terascope/job-components';
import { Logger, DataEntity } from '@terascope/core-utils';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';
import { readData } from '../helpers/kafka-data.js';
import { connectorConfig, deadLetterTopic } from '../helpers/config.js';
import KafkaAdmin from '../helpers/kafka-admin.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const testFetcherFile = path.join(dirname, '../fixtures', 'test-fetcher-data.json');

describe('Kafka Dead Letter', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            ...connectorConfig,
        },
        createClient(config: any, logger: Logger, settings: any) {
            return Connector.createClient(config, logger, settings);
        }
    };

    const topic = deadLetterTopic;

    const clients = [clientConfig];

    const circular: Record<string, any> = { bad: 'circular' };
    circular.self = circular;

    const badRecords = [
        Buffer.from('bad buffer'),
        'bad string',
        { bad: 'object' },
        DataEntity.make({ bad: 'entity' }),
        null,
        circular,
        { bad: 'bigint', value: 10n },
    ];

    const job = newTestJobConfig({
        max_retries: 3,
        apis: [
            {
                _name: 'kafka_dead_letter',
                topic,
                size: 1,
                wait: 20,
            }
        ],
        operations: [
            {
                _op: 'test-reader',
                fetcher_data_file_path: testFetcherFile
            },
            {
                _op: 'noop',
                _dead_letter_action: 'kafka_dead_letter'
            }
        ],
    });

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;
    let noop: NoopProcessor;
    let consumed: Record<string, any>[] = [];

    beforeAll(async () => {
        jest.restoreAllMocks();

        await admin.ensureTopic(topic);

        harness = new WorkerTestHarness(job, {
            clients,
        });
        await harness.initialize();

        noop = harness.getOperation('noop');

        noop.onBatch = async (batch: DataEntity[]) => {
            for (const record of badRecords) {
                const err = new Error('Uh no!');
                noop.rejectRecord(record, err);
            }
            return batch;
        };

        await harness.runSlice({});

        consumed = await readData(topic, badRecords.length);
    });

    afterAll(async () => {
        jest.resetAllMocks();

        admin.disconnect();

        await harness.shutdown();
    });

    it('should have produced all of the bad records', () => {
        expect(consumed).toBeArrayOfSize(badRecords.length);

        for (const expected of consumed) {
            expect(expected).toHaveProperty('error');
            expect(expected).toHaveProperty('record');
        }
    });

    it('should safely serialize records with circular references', () => {
        const circularRecord = consumed.find(
            (msg) => typeof msg.record === 'string' && msg.record.includes('"bad":"circular"')
        );

        expect(circularRecord).toBeDefined();
        expect(circularRecord!.record).toInclude('[Circular]');
    });

    it('should safely serialize records containing BigInt values', () => {
        const bigIntRecord = consumed.find(
            (msg) => typeof msg.record === 'string' && msg.record.includes('"bad":"bigint"')
        );

        expect(bigIntRecord).toBeDefined();
        expect(bigIntRecord!.record).toInclude('"value":"10"');
    });

    describe('when the topic does not exist', () => {
        const missingTopic = `${deadLetterTopic}-missing`;

        let missingHarness: WorkerTestHarness | undefined;

        function makeHarness(rdkafkaOptions: Record<string, any> = {}) {
            const missingJob = newTestJobConfig({
                apis: [
                    {
                        _name: 'kafka_dead_letter',
                        topic: missingTopic,
                    }
                ],
                operations: [
                    {
                        _op: 'test-reader',
                        passthrough_slice: true
                    },
                    {
                        _op: 'noop',
                        _dead_letter_action: 'kafka_dead_letter'
                    }
                ],
            });

            missingHarness = new WorkerTestHarness(missingJob, {
                clients: [{
                    ...clientConfig,
                    config: {
                        ...clientConfig.config,
                        rdkafka_options: rdkafkaOptions
                    }
                }]
            });
            return missingHarness;
        }

        beforeEach(async () => {
            await admin.ensureTopicDeleted(missingTopic);
        });

        afterEach(async () => {
            if (missingHarness) {
                await missingHarness.shutdown().catch(() => {});
                missingHarness = undefined;
            }
        });

        afterAll(async () => {
            await admin.ensureTopicDeleted(missingTopic);
        });

        it('should create the topic on initialize if settings allow', async () => {
            await expect(makeHarness().initialize()).toResolve();

            const topics = await admin.listTopics();
            expect(topics).toContain(missingTopic);
        });

        it('should throw on initialize if the topic could not be created', async () => {
            // the test broker allows auto topic creation, so disable it on the client instead
            const harnessWithoutAutoCreate = makeHarness({ 'allow.auto.create.topics': false });

            await expect(harnessWithoutAutoCreate.initialize())
                .rejects.toThrow(`Topic ${missingTopic} does not exist and could not be created.`);

            const topics = await admin.listTopics();
            expect(topics).not.toContain(missingTopic);
        });
    });
});
