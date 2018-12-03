import 'jest-extended';
import uuidv4 from 'uuid/v4';
import { TestClientConfig, Logger, DataEntity, NoopProcessor } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaFetcher from '../asset/src/kafka_reader/fetcher';
import KafkaAdmin from './helpers/kafka-admin';
import { loadData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';

describe('Kafka Fetcher', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: ['localhost:9092'],
        },
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const topic = 'example-fetcher-data-set';
    const group = uuidv4();

    const clients = [clientConfig];

    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'kafka_reader',
                topic,
                group,
                size: 100,
                wait: 2000,
                bad_record_action: 'log',
                rollback_on_failure: true
            },
            {
                _op: 'noop'
            }
        ],
    });

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    const fetcher = harness.fetcher<KafkaFetcher>();
    const noop = harness.getOperation<NoopProcessor>('noop');

    noop.onBatch = jest.fn(async (data) => {
        return data;
    });

    let exampleData: object[];
    let results: DataEntity[] = [];

    const kafkaAdmin = new KafkaAdmin();

    async function runTest() {
        await harness.initialize();

        results = results.concat(await harness.runSlice({}));
        results = results.concat(await harness.runSlice({}));
    }

    beforeAll(async () => {
        jest.restoreAllMocks();

        await kafkaAdmin.ensureTopic(topic);

        // it should be able to call connect
        await fetcher.consumer.connect();

        const [data] = await Promise.all([
            loadData(topic, 'example-data.txt'),
            runTest(),
        ]);

        exampleData = data;

    });

    afterAll(async () => {
        jest.resetAllMocks();

        // it should be able to disconnect twice
        await fetcher.consumer.disconnect();

        await Promise.all([
            harness.shutdown(),
            kafkaAdmin.close(),
        ]);
    });

    it('should return a list of records', () => {
        expect(results).toBeArrayOfSize(exampleData.length);
        expect(DataEntity.isDataEntityArray(results)).toBeTrue();

        for (let i = 0; i < exampleData.length; i++) {
            const actual = results[i];
            const expected = exampleData[i];

            expect(DataEntity.isDataEntity(actual)).toBeTrue();
            expect(actual).toEqual(expected);
        }
    });

    it('should have committed the results', async () => {
        const result = await fetcher.consumer.topicPositions();
        expect(result).toEqual([
            {
                topic,
                // I think it is set to length + 1 because
                // when it restarts with that offset it returns
                // the length + 1 entity
                offset: results.length + 1,
                partition: 0,
            }
        ]);
    });

    describe('when resetting back to zero', () => {
        beforeAll(async () => {
            await fetcher.consumer.seek({
                partition: 0,
                offset: 0,
            });
        });

        describe('when a processor fails once', () => {
            const err = new Error('Failure is part of life');
            const onSliceRetry = jest.fn();
            harness.events.on('slice:retry', onSliceRetry);

            let retryResults: DataEntity[] = [];

            beforeAll(async () => {
                // @ts-ignore
                noop.onBatch.mockRejectedValueOnce(err);

                retryResults = retryResults.concat(await harness.runSlice({}));
                retryResults = retryResults.concat(await harness.runSlice({}));
            });

            it('should have called onSliceRetry', async () => {
                expect(onSliceRetry).toHaveBeenCalled();
            });

            it('should return the correct list of records', () => {
                expect(retryResults).toBeArrayOfSize(exampleData.length);
                expect(DataEntity.isDataEntityArray(retryResults)).toBeTrue();

                for (let i = 0; i < exampleData.length; i++) {
                    const actual = retryResults[i];
                    const expected = exampleData[i];

                    expect(DataEntity.isDataEntity(actual)).toBeTrue();
                    expect(actual).toEqual(expected);
                }
            });

            it('should have committed the results', async () => {
                const result = await fetcher.consumer.topicPositions();
                expect(result).toEqual([
                    {
                        topic,
                        offset: results.length + 1,
                        partition: 0,
                    }
                ]);
            });
        });
    });
});
