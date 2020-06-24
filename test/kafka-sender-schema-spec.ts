import 'jest-extended';
import {
    TestContext, newTestJobConfig, OpConfig, APIConfig, ValidatedJobConfig
} from '@terascope/job-components';
import { WorkerTestHarness } from 'teraslice-test-harness';
import Schema from '../asset/src/kafka_sender/schema';

describe('Kafka Sender Schema', () => {
    const context = new TestContext('kafka-sender');
    const schema = new Schema(context);
    let harness: WorkerTestHarness;

    async function makeTest(config: OpConfig, apiConfig?: APIConfig) {
        const testJob: Partial<ValidatedJobConfig> = {
            analytics: true,
            apis: [],
            operations: [
                config,
                {
                    _op: 'noop',
                },
            ],
        };

        if (apiConfig) testJob!.apis!.push(apiConfig);

        const job = newTestJobConfig(testJob);

        harness = new WorkerTestHarness(job);

        await harness.initialize();
    }

    afterEach(async () => {
        if (harness) await harness.shutdown();
    });

    describe('when validating the schema', () => {
        it('should throw an error if no topic is specified', async () => {
            expect(async () => makeTest({
                _op: 'kafka_sender'
            })).toReject();
        });

        it('should not throw an error if valid config is given', () => {
            expect(async () => makeTest({
                _op: 'kafka_sender',
                topic: 'hello'
            })).toResolve();
        });

        it('should not throw an error if api and sender make a valid config', () => {
            const opConfig = { _op: 'kafka_sender' };
            const apiConfig = { _name: 'kafka_sender_api', topic: 'hello' };

            expect(async () => makeTest(opConfig, apiConfig)).toResolve();
        });

        it('should set the required_acks default to 1', () => {
            expect(schema.validate({
                _op: 'kafka_sender',
                topic: 'hello',
                size: 1
            })).toMatchObject({
                required_acks: 1
            });
        });
    });
});
