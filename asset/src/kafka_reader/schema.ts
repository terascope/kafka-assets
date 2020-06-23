import { ConvictSchema, ValidatedJobConfig, getOpConfig, isNotNil, isNil } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';

export default class Schema extends ConvictSchema<KafkaReaderConfig> {
    validateJob(job: ValidatedJobConfig): void {
        const secondOp = job.operations[1] && job.operations[1]._op;

        if (secondOp === 'json_protocol') {
            throw new Error('Kafka Reader handles serialization, please remove "json_protocol"');
        }
        //  this.validate();
        const config = getOpConfig(job, 'kafka_reader') as KafkaReaderConfig;

        const apiName = config.api_name;

        if (isNotNil(apiName)) {
            const kafkaReaderAPI = job.apis.find((api) => api._name === apiName);
            if (isNil(kafkaReaderAPI)) throw new Error(`kafka_reader parameter for api_name: "${kafkaReaderAPI}" was not found listed in the apis of this execution ${JSON.stringify(job, null, 4)}`);
        } else {
            this.injectApi(job);
            // this.validate(newJob);
        }
    }

    injectApi(config: ValidatedJobConfig): void {
        config.apis.push({
            _name: 'kafka_reader_api'
        });
    }

    build(): Record<string, any> {
        return {
            topic: {
                doc: 'Name of the Kafka topic to process',
                default: '',
                format: 'required_String'
            },
            api_name: {
                doc: 'Name of kafka api used for reader, if none is provided, then one is made and the name is kafka_reader_api, and is injected into the execution',
                default: null,
                format: 'optional_String'
            },
            group: {
                doc: 'Name of the Kafka consumer group',
                default: '',
                format: 'required_String'
            },
            offset_reset: {
                doc: 'How offset resets should be handled when there are no valid offsets for the consumer group.',
                default: 'smallest',
                format: ['smallest', 'earliest', 'beginning', 'largest', 'latest', 'error']
            },
            size: {
                doc: 'How many records to read before a slice is considered complete.',
                default: 10000,
                format: Number
            },
            wait: {
                doc: 'How long to wait for a full chunk of data to be available. Specified in milliseconds.',
                default: '30 seconds',
                format: 'duration'
            },
            max_poll_interval: {
                doc: [
                    'The maximum delay between invocations of poll() when using consumer group management.',
                    'This places an upper bound on the amount of time that the consumer can be idle before fetching more records.',
                    'If poll() is not called before expiration of this timeout,',
                    'then the consumer is considered failed',
                    'and the group will rebalance in order to reassign the partitions to another member.',
                ].join(' '),
                default: '5 minutes',
                format: 'duration'
            },
            connection: {
                doc: 'The Kafka consumer connection to use.',
                default: 'default',
                format: 'required_String'
            },
            use_commit_sync: {
                doc: 'Use commit sync instead of async (usually not recommended)',
                default: false,
                format: Boolean
            },
            rollback_on_failure: {
                doc: [
                    'Controls whether the consumer state is rolled back on failure.',
                    'This will protect against data loss,',
                    'however this can have an unintended side effect of blocking the job from moving if failures are minor and persistent.',
                    '**NOTE:** This currently defaults to `false` due to the side effects of the behavior,',
                    'at some point in the future it is expected this will default to `true`.',
                ].join(' '),
                default: false,
                format: Boolean
            },
            partition_assignment_strategy: {
                doc: 'Name of partition assignment strategy to use when elected group leader assigns partitions to group members.',
                default: '',
                format: ['range', 'roundrobin', '']
            }
        };
    }
}
