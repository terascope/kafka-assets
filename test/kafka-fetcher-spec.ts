import 'jest-extended';
import uuidv4 from 'uuid/v4';
import { TestClientConfig, Logger, DataEntity } from '@terascope/job-components';
import { WorkerTestHarness, newTestJobConfig } from 'teraslice-test-harness';
import KafkaAdmin from './helpers/kafka-admin';
import { loadData } from './helpers/kafka-data';
import Connector from '../packages/terafoundation_kafka_connector/dist';

describe('Kafka Reader', () => {
    jest.setTimeout(15 * 1000);

    const clientConfig: TestClientConfig = {
        type: 'kafka',
        create(config: any, logger: Logger, settings: any) {
            return Connector.create(Object.assign(config, {
                brokers: ['localhost:9092'],
            }), logger, settings);
        }
    };

    const topic = 'example-data-set';
    const group = uuidv4();

    const clients = [clientConfig];

    // @ts-ignore
    const job = newTestJobConfig({
        max_retries: 1,
        operations: [
            {
                _op: 'teraslice_kafka_reader',
                topic,
                group,
                size: 100,
                wait: 2000,
                bad_record_action: 'log'
            },
            {
                _op: 'noop'
            }
        ],
    });

    const harness = new WorkerTestHarness(job, {
        clients,
    });

    harness.processors[0].onBatch = jest.fn(async (data) => {
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
        await harness.fetcher.consumer.connect();

        const [data] = await Promise.all([
            loadData(topic, 'example-data.txt'),
            runTest(),
        ]);

        exampleData = data;

    });

    afterAll(async () => {
        jest.resetAllMocks();

        // it should be able to disconnect twice
        await harness.fetcher.consumer.disconnect();

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
        const result = await harness.fetcher.consumer.topicPositions();
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
            await harness.fetcher.consumer.seek({
                partition: 0,
                offset: 0,
            });
        });

        describe('when a processor throws on the second run', () => {
            const err = new Error('Failure is part of life');
            const onSliceRetry = jest.fn();
            harness.events.on('slice:retry', onSliceRetry);

            beforeAll(async () => {
                harness.processors[0].onBatch
                    .mockImplementationOnce(async (data: DataEntity[]) => data)
                    .mockRejectedValueOnce(err);
            });

            it('should not fail the first time', () => {
                return expect(harness.runSlice({})).resolves.not.toBeNil();
            });

            it('should fail when called again', () => {
                return expect(harness.runSlice({})).rejects.toThrowError('Failure is part of life');
            });

            xit('should have called onSliceRetry', () => {
                expect(onSliceRetry).toHaveBeenCalled();
            });
        });
    });
});
