import { ConvictSchema, JobConfig } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';

export default class Schema extends ConvictSchema<KafkaReaderConfig> {
    validateJob(job: JobConfig) {
        const secondOp = job.operations[1] && job.operations[1]._op;

        if (secondOp === 'json_protocol') {
            throw new Error('Kafka Reader handles serialization, please remove "json_protocol"');
        }
    }

    build() {
        return {
            topic: {
                doc: 'Name of the Kafka topic to process',
                default: '',
                format: 'required_String'
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
                default: 30000,
                format: Number
            },
            interval: {
                doc: 'How often to attempt to consume "size" number of records. This only comes into play if the initial consume could not get a full slice.',
                default: 50,
                format: Number
            },
            connection: {
                doc: 'The Kafka consumer connection to use.',
                default: 'default',
                format: 'required_String'
            },
            rollback_on_failure: {
                doc: `Controls whether the consumer state is rolled back on failure. This will protect against data loss, however this can have an unintended
                    side effect of blocking the job from moving if failures are minor and persistent.
                    NOTE: This currently defaults to "false" due to the side effects of the behavior, at some point in the future it is expected this will default to "true".`,
                default: false,
                format: Boolean
            },
            bad_record_action: {
                doc: 'How to handle bad records, defaults to doing nothing',
                default: 'none',
                format: ['none', 'throw', 'log']
            }
        };
    }
}
