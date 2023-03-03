"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const job_components_1 = require("@terascope/job-components");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const kafka_data_1 = require("../helpers/kafka-data");
const config_1 = require("../helpers/config");
const kafka_admin_1 = __importDefault(require("../helpers/kafka-admin"));
const logger = (0, job_components_1.debugLogger)('test-kafka-fetcher');
describe('Kafka Fetcher', () => {
    jest.setTimeout(30 * 1000);
    const clientConfig = {
        type: 'kafka',
        config: {
            brokers: config_1.kafkaBrokers,
        },
        create(config, _logger, settings) {
            return terafoundation_kafka_connector_1.default.create(config, _logger, settings);
        }
    };
    const topic = config_1.fetcherTopic;
    const group = config_1.fetcherGroup;
    const clients = [clientConfig];
    const job = (0, teraslice_test_harness_1.newTestJobConfig)({
        max_retries: 3,
        operations: [
            {
                _op: 'kafka_reader',
                topic,
                group,
                size: 100,
                wait: 8000,
                rollback_on_failure: true,
                _dead_letter_action: 'log'
            },
            {
                _op: 'noop'
            }
        ],
    });
    const admin = new kafka_admin_1.default();
    let harness;
    let fetcher;
    let noop;
    let exampleData;
    let results = [];
    const _fatalErr = new Error('Timeout run beforeEach');
    _fatalErr.fatalError = true;
    let fatalError = _fatalErr;
    function checkFatalError() {
        if (!fatalError)
            return false;
        expect(fatalError.message).toEqual('Kafka Client is in an invalid state');
        expect(fatalError.fatalError).toBeTrue();
        return true;
    }
    beforeAll(async () => {
        jest.restoreAllMocks();
        await admin.ensureTopic(topic);
        harness = new teraslice_test_harness_1.WorkerTestHarness(job, {
            clients,
        });
        // FIXME: using "as any" is hack, we should properly fix it
        fetcher = harness.fetcher();
        noop = harness.getOperation('noop');
        noop.onBatch = jest.fn(async (data) => data);
        await harness.initialize();
        // it should be able to call connect
        await fetcher.consumer.connect();
        exampleData = await (0, kafka_data_1.loadData)(topic, 'example-data.txt');
        async function runSlice() {
            if (results.length >= exampleData.length) {
                logger.debug('all results created');
                return;
            }
            const moreResults = await harness.runSlice({});
            logger.debug(`got ${moreResults.length} results`);
            results = results.concat(moreResults);
        }
        try {
            await runSlice();
            // disconnect in-order to prove the connection can reconnect
            await new Promise((resolve, reject) => {
                logger.debug('disconnecting...');
                // @ts-expect-error
                fetcher.consumer._client.disconnect((err) => {
                    logger.debug('disconnected', { err });
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await runSlice();
            await runSlice();
            await runSlice();
            fatalError = null;
        }
        catch (err) {
            fatalError = err;
        }
    });
    afterAll(async () => {
        jest.resetAllMocks();
        admin.disconnect();
        // it should be able to disconnect twice
        await fetcher.consumer.disconnect();
        // @ts-expect-error
        // eslint-disable-next-line jest/no-standalone-expect
        await expect(fetcher.consumer._beforeTry()).rejects.toThrowError('Client is closed');
        await harness.shutdown();
    });
    it('should able to call _clientEvents without double listening', () => {
        if (checkFatalError())
            return;
        // @ts-expect-error
        const expected = fetcher.consumer._client.listenerCount('error');
        expect(() => {
            // @ts-expect-error
            fetcher.consumer._clientEvents();
        }).not.toThrowError();
        // @ts-expect-error
        const actual = fetcher.consumer._client.listenerCount('error');
        expect(actual).toEqual(expected);
    });
    it('should return a list of records', () => {
        if (checkFatalError())
            return;
        expect(results).toBeArrayOfSize(exampleData.length);
        expect(job_components_1.DataEntity.isDataEntityArray(results)).toBeTrue();
        for (let i = 0; i < exampleData.length; i++) {
            const actual = results[i];
            const expected = exampleData[i];
            expect(job_components_1.DataEntity.isDataEntity(actual)).toBeTrue();
            expect(actual).toEqual(expected);
        }
    });
    it('should have committed the results', async () => {
        if (checkFatalError())
            return;
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
            }
            catch (err) {
                fatalError = err;
            }
        });
        describe('when a processor fails once', () => {
            const onSliceRetry = jest.fn();
            let retryResults = [];
            beforeAll(async () => {
                const err = new Error('Failure is part of life');
                harness.events.on('slice:retry', onSliceRetry);
                // @ts-expect-error
                noop.onBatch.mockRejectedValueOnce(err);
                try {
                    retryResults = retryResults.concat(await harness.runSlice({}));
                    retryResults = retryResults.concat(await harness.runSlice({}));
                }
                catch (_err) {
                    fatalError = _err;
                }
            });
            it('should have called onSliceRetry', async () => {
                if (checkFatalError())
                    return;
                expect(onSliceRetry).toHaveBeenCalled();
            });
            it('should return the correct list of records', () => {
                if (checkFatalError())
                    return;
                expect(retryResults).toBeArrayOfSize(exampleData.length);
                expect(job_components_1.DataEntity.isDataEntityArray(retryResults)).toBeTrue();
                for (let i = 0; i < exampleData.length; i++) {
                    const actual = retryResults[i];
                    const expected = exampleData[i];
                    expect(job_components_1.DataEntity.isDataEntity(actual)).toBeTrue();
                    expect(actual).toEqual(expected);
                }
            });
            it('should have committed the results', async () => {
                if (checkFatalError())
                    return;
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
//# sourceMappingURL=fetcher-spec.js.map