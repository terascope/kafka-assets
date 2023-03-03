"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const job_components_1 = require("@terascope/job-components");
const teraslice_test_harness_1 = require("teraslice-test-harness");
const terafoundation_kafka_connector_1 = __importDefault(require("terafoundation_kafka_connector"));
const schema_1 = __importDefault(require("../../asset/src/kafka_reader/schema"));
const config_1 = require("../helpers/config");
// increase the timeout because CI has been failing a bit
jest.setTimeout(15000);
describe('Kafka Reader Schema', () => {
    let context;
    let schema;
    let harness;
    afterAll(() => {
        context.apis.foundation.getSystemEvents().removeAllListeners();
    });
    beforeEach(() => {
        context = new job_components_1.TestContext('kafka-reader');
        schema = new schema_1.default(context);
    });
    afterEach(async () => {
        if (harness)
            await harness.shutdown();
    });
    describe('when validating the job', () => {
        it('should throw an error if including json_protocol', () => {
            const job = (0, job_components_1.newTestJobConfig)({
                operations: [
                    {
                        _op: 'kafka_reader',
                    },
                    {
                        _op: 'json_protocol',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrowError('Kafka Reader handles serialization, please remove "json_protocol"');
        });
        it('should not throw if a valid job is given', () => {
            const job = (0, job_components_1.newTestJobConfig)({
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'hello',
                        group: 'hi'
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).not.toThrowError();
        });
        it('should inject an api if none is specified', () => {
            const job = (0, job_components_1.newTestJobConfig)({
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'hello',
                        group: 'hi'
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
                expect(job.apis).toBeArrayOfSize(1);
                const apiConfig = job.apis[0];
                if (!apiConfig)
                    throw new Error('No api was created');
                expect(apiConfig._name.startsWith('kafka_reader_api')).toBeTrue();
                expect(job.apis[0]).toMatchObject({ topic: 'hello', group: 'hi' });
            }).not.toThrowError();
        });
        it('should throw if topic/group is specified differently in opConfig if api is set with api_name', () => {
            const job = (0, job_components_1.newTestJobConfig)({
                apis: [
                    { _name: 'kafka_reader_api', topic: 'hello', group: 'hi' }
                ],
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'hello',
                        group: 'something_else',
                        api_name: 'kafka_reader_api'
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrowError();
        });
        it('should associate with default kafka sender if no api_name is specified', () => {
            const job = (0, job_components_1.newTestJobConfig)({
                apis: [
                    { _name: 'kafka_reader_api:kafka_reader-0', topic: 'hello', group: 'hi' }
                ],
                operations: [
                    {
                        _op: 'kafka_reader',
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).not.toThrowError();
        });
        it('should associate with default kafka sender and throw if configs are incorrect', () => {
            const job = (0, job_components_1.newTestJobConfig)({
                apis: [
                    { _name: 'kafka_reader_api:kafka_reader-0', topic: 'hello', group: 'hi' }
                ],
                operations: [
                    {
                        _op: 'kafka_reader',
                        topic: 'something_else',
                    },
                    {
                        _op: 'noop',
                    }
                ]
            });
            expect(() => {
                schema.validateJob(job);
            }).toThrowError();
        });
    });
    describe('when validating the schema', () => {
        const clientConfig = {
            type: 'kafka',
            config: {
                brokers: config_1.kafkaBrokers,
            },
            create(config, _logger, settings) {
                return terafoundation_kafka_connector_1.default.create(config, _logger, settings);
            }
        };
        const clients = [clientConfig];
        async function makeTest(config, apiConfig) {
            const testJob = {
                analytics: true,
                apis: [],
                operations: [
                    config,
                    {
                        _op: 'noop',
                    },
                ],
            };
            if (apiConfig)
                testJob.apis.push(apiConfig);
            const job = (0, job_components_1.newTestJobConfig)(testJob);
            harness = new teraslice_test_harness_1.WorkerTestHarness(job, { clients });
            await harness.initialize();
        }
        it('should throw an error if no topic is specified', async () => {
            await expect(makeTest({ _op: 'kafka_reader', group: 'hello' })).toReject();
        });
        it('should throw an error if no group is specified', async () => {
            await expect(makeTest({ _op: 'kafka_reader', topic: 'hello' })).toReject();
        });
        it('should not throw an error if valid config is given', async () => {
            await expect(makeTest({ _op: 'kafka_reader', topic: 'hello', group: 'hello' })).toResolve();
        });
        it('should not throw an error if topic or group is provided in api', async () => {
            const opConfig = { _op: 'kafka_reader', api_name: 'kafka_reader_api' };
            const apiConfig = { _name: 'kafka_reader_api', topic: 'hello', group: 'hello' };
            await expect(makeTest(opConfig, apiConfig)).toResolve();
        });
    });
});
//# sourceMappingURL=schema-spec.js.map