import { jest } from '@jest/globals';
import 'jest-extended';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestClientConfig } from '@terascope/job-components';
import { Logger, DataEntity, parseJSON } from '@terascope/core-utils';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import Connector from 'terafoundation_kafka_connector';
import KafkaSender from '../../asset/src/kafka_sender/processor.js';
import { readData } from '../helpers/kafka-data.js';
import { kafkaBrokers, senderTopic } from '../helpers/config.js';
import KafkaAdmin from '../helpers/kafka-admin.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const testFetcherFile = path.join(dirname, '../fixtures', 'test-fetcher-data.json');
const testFetcherData: Record<string, any>[] = parseJSON(fs.readFileSync(testFetcherFile));

describe('Kafka Sender', () => {
    jest.setTimeout(15 * 1000);
    const mockFlush = jest.fn();

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        async createClient(config: any, logger: Logger, settings: any) {
            const result = await Connector.createClient(config, logger, settings);
            // @ts-expect-error
            result.client.flush = mockFlush
                // @ts-expect-error
                .mockImplementation(result.client.flush)
                .bind(result.client);
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
        jest.clearAllMocks();

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
        expect(mockFlush).toHaveBeenCalledTimes(expected);
    });
});
