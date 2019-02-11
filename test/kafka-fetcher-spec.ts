import 'jest-extended';
import { TestClientConfig, Logger, DataEntity, NoopProcessor, debugLogger } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import { FatalError } from '../asset/src/_kafka_clients';
import KafkaFetcher from '../asset/src/kafka_reader/fetcher';
import { loadData } from './helpers/kafka-data';
import { kafkaBrokers, fetcherTopic, fetcherGroup } from './helpers/config';
import Connector from '../packages/terafoundation_kafka_connector/dist';
import KafkaAdmin from './helpers/kafka-admin';

const logger = debugLogger('test-kafka-fetcher');

describe('Kafka Fetcher', () => {
    jest.setTimeout(30 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        config: {
            brokers: kafkaBrokers,
        },
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(config, logger, settings);
        }
    };

    const topic = fetcherTopic;
    const group = fetcherGroup;

    const clients = [clientConfig];

    const job = newTestJobConfig({
        max_retries: 3,
        operations: [
            {
                _op: 'kafka_reader',
                topic,
                group,
                size: 100,
                wait: 8000,
                rollback_on_failure: true
            },
            {
                _op: 'noop'
            }
        ],
    });

    const admin = new KafkaAdmin();

    let harness: WorkerTestHarness;
    let fetcher: KafkaFetcher;
    let noop: NoopProcessor;
    let exampleData: object[];
    let results: DataEntity[] = [];

    const _fatalErr = new Error('Timeout run beforeEach') as FatalError;
    _fatalErr.fatalError = true;
    let fatalError: FatalError|null = _fatalErr;

    function checkFatalError(): boolean {
        if (!fatalError) return false;

        expect(fatalError.message).toEqual('Kafka Client is in an invalid state');
        expect(fatalError.fatalError).toBeTrue();
        return true;
    }

    beforeAll(async () => {
        jest.restoreAllMocks();

        await admin.ensureTopic(topic);

        harness = new WorkerTestHarness(job, {
            clients,
        });

        fetcher = harness.fetcher();
        noop = harness.getOperation('noop');

        noop.onBatch = jest.fn(async (data) => {
            return data;
        });

        await harness.initialize();

        // it should be able to call connect
        await fetcher.consumer.connect();

        exampleData = await loadData(topic, 'example-data.txt');

        try {
            const results1 = await harness.runSlice({});
            results = results.concat(results1);
            logger.debug(`got ${results1.length} results on the first run, disconnecting...`);

            // disconnect in-order to prove the connection can reconnect
            await new Promise((resolve, reject) => {
                // @ts-ignore
                fetcher.consumer._client.disconnect((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            logger.debug('disconnected');

            const results2 = await harness.runSlice({});
            results = results.concat(results2);
            logger.debug(`got ${results2.length} results on the second run`);

            const results3 = await harness.runSlice({});
            results = results.concat(results3);
            logger.debug(`got ${results3.length} results on the third run`);

            fatalError = null;
        } catch (err) {
            fatalError = err;
        }
    });

    afterAll(async () => {
        jest.resetAllMocks();

        admin.disconnect();

        // it should be able to disconnect twice
        await fetcher.consumer.disconnect();

        // @ts-ignore
        await expect(fetcher.consumer._beforeTry()).rejects.toThrowError('Client is closed');

        await harness.shutdown();
    });

    it('should able to call _clientEvents without double listening', () => {
        if (checkFatalError()) return;
        // @ts-ignore
        const expected = fetcher.consumer._client.listenerCount('error');

        expect(() => {
            // @ts-ignore
            fetcher.consumer._clientEvents();
        }).not.toThrowError();

        // @ts-ignore
        const actual = fetcher.consumer._client.listenerCount('error');

        expect(actual).toEqual(expected);
    });

    it('should return a list of records', () => {
        if (checkFatalError()) return;

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
        if (checkFatalError()) return;

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

        expect(fetcher.consumer.handlePendingCommits()).toBeTrue();
    });

    describe('when resetting back to zero', () => {
        beforeAll(async () => {
            try {
                await fetcher.consumer.seek({
                    partition: 0,
                    offset: 0,
                });
            } catch (err) {
                fatalError = err;
            }
        });

        describe('when a processor fails once', () => {
            const onSliceRetry = jest.fn();

            let retryResults: DataEntity[] = [];

            beforeAll(async () => {
                const err = new Error('Failure is part of life');
                harness.events.on('slice:retry', onSliceRetry);

                // @ts-ignore
                noop.onBatch.mockRejectedValueOnce(err);

                try {
                    retryResults = retryResults.concat(await harness.runSlice({}));
                    retryResults = retryResults.concat(await harness.runSlice({}));
                } catch (err) {
                    fatalError = err;
                }
            });

            it('should have called onSliceRetry', async () => {
                if (checkFatalError()) return;

                expect(onSliceRetry).toHaveBeenCalled();
            });

            it('should return the correct list of records', () => {
                if (checkFatalError()) return;

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
                if (checkFatalError()) return;

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
