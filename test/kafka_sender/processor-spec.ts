import { jest } from '@jest/globals';
import 'jest-extended';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestClientConfig } from '@terascope/job-components';
import { DataEntity, parseJSON } from '@terascope/core-utils';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';
import KafkaSender from '../../asset/src/kafka_sender/processor.js';
import { readData } from '../helpers/kafka-data.js';
import { connectorConfig, senderTopic } from '../helpers/config.js';
import KafkaAdmin from '../helpers/kafka-admin.js';
import { KafkaConnectorConfig, KafkaProducerSettings, KafkaProducerResult } from 'packages/terafoundation_kafka_connector/src/interfaces.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const testFetcherFile = path.join(dirname, '../fixtures', 'test-fetcher-data.json');
const testFetcherData: Record<string, any>[] = parseJSON(fs.readFileSync(testFetcherFile));

describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);
    let flushSpy: any;

    const clientConfig: TestClientConfig = {
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
                _api_name: 'kafka_sender_api',
                _dead_letter_action: 'log'
            }
        ],
        apis: [
            {
                _name: 'kafka_sender_api',
                topic,
                size: batchSize,
            }
        ]
    });

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;
    let kafkaSender: KafkaSender;
    let results: DataEntity[] = [];
    let consumed: Record<string, any>[] = [];
    let runs = 0;

    beforeAll(async () => {
        jest.clearAllMocks();

        await admin.ensureTopic(topic);

        harness = new WorkerTestHarness(job, {
            clients,
        });
        await harness.initialize();

        kafkaSender = harness.getOperation('kafka_sender');

        flushSpy = jest.spyOn(Object.getPrototypeOf(kafkaSender.api.producer), '_flush');

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
        jest.restoreAllMocks();

        admin.disconnect();

        // it should be able to disconnect twice
        const shutdownList = [];

        for (const { sender } of kafkaSender.topicMap.values()) {
            shutdownList.push(sender.disconnect());
        }

        await Promise.all(shutdownList);
        await harness.shutdown();
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

    it('should able to call _clientEvents without double listening', () => {
        const expectedTopic = kafkaSender.api;
        // @ts-expect-error
        const expected = expectedTopic.producer._client.listenerCount('error');

        expect(() => {
            const testTopic = kafkaSender.api;
            // @ts-expect-error
            testTopic.producer._clientEvents();
        }).not.toThrow();

        const actualTopic = kafkaSender.api;
        // @ts-expect-error
        const actual = actualTopic.producer._client.listenerCount('error');

        expect(actual).toEqual(expected);
    });

    it('should call flush once per run and before the buffer is full', () => {
        const bufferSize = 1000000;
        const expected = runs + Math.floor(results.length / bufferSize);
        expect(flushSpy).toHaveBeenCalledTimes(expected);
    });

    // Test produceV2 (retry_on_full) end-to-end through the processor.
    // Uses a separate topic to avoid readData picking up records from the
    // threshold_flush runs above (readData starts from offset 0 with a fresh group).
    describe('with retry_on_full strategy (produceV2)', () => {
        const topicV2 = `${senderTopic}-v2`;

        const jobV2 = newTestJobConfig({
            max_retries: 3,
            operations: [
                {
                    _op: 'test-reader',
                    fetcher_data_file_path: testFetcherFile
                },
                {
                    _op: 'kafka_sender',
                    _api_name: 'kafka_sender_api',
                    _dead_letter_action: 'log'
                }
            ],
            apis: [
                {
                    _name: 'kafka_sender_api',
                    topic: topicV2,
                    size: batchSize,
                    queue_backpressure_strategy: 'retry_on_full'
                }
            ]
        });

        let harnessV2: WorkerTestHarness;
        let kafkaSenderV2: KafkaSender;
        let resultsV2: DataEntity[] = [];
        let consumedV2: Record<string, any>[] = [];
        let runsV2 = 0;

        beforeAll(async () => {
            await admin.ensureTopic(topicV2);

            harnessV2 = new WorkerTestHarness(jobV2, { clients });
            await harnessV2.initialize();

            kafkaSenderV2 = harnessV2.getOperation('kafka_sender');

            while (resultsV2.length < targetSize) {
                if (runsV2 > targetRuns) return;
                runsV2++;
                const batch = await harnessV2.runSlice({});
                resultsV2 = resultsV2.concat(batch);
            }

            consumedV2 = await readData(topicV2, resultsV2.length);
        });

        afterAll(async () => {
            const shutdownList = [];
            for (const { sender } of kafkaSenderV2.topicMap.values()) {
                shutdownList.push(sender.disconnect());
            }
            await Promise.all(shutdownList);
            await harnessV2.shutdown();
        });

        it('should have produced the correct amount of records', () => {
            expect(consumedV2).toBeArrayOfSize(resultsV2.length);
            expect(DataEntity.isDataEntityArray(resultsV2)).toBeTrue();
            expect(resultsV2).toBeArrayOfSize(targetSize);
            expect(runsV2).toBe(targetRuns);

            for (let i = 0; i < resultsV2.length; i++) {
                expect(consumedV2[i]).toEqual(resultsV2[i]);
            }
        });
    });
});
