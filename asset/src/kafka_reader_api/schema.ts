import {
    ConvictSchema,
    isNumber,
    getTypeOf,
    isPlainObject
} from '@terascope/job-components';
import { KafkaReaderAPIConfig } from './interfaces.js';

export const DEFAULT_API_NAME = 'kafka_reader_api';

export const schema = {
    topic: {
        doc: 'Name of the Kafka topic to process',
        default: null,
        format: 'required_String'
    },
    group: {
        doc: 'Name of the Kafka consumer group',
        default: null,
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
        format: (val: unknown): void => {
            if (isNumber(val)) {
                if (val <= 0) throw new Error('Invalid parameter size, it must be a positive number');
            } else {
                throw new Error(`Invalid parameter size, it must be a number, got ${getTypeOf(val)}`);
            }
        }
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
        format: 'optional_String'
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
        format: ['range', 'roundrobin', 'cooperative-sticky', '']
    },
    rdkafka_options: {
        doc: 'librdkafka defined settings that are not subscription specific. Settings here will override other settings.',
        default: {},
        format: (val: any) => {
            if (!isPlainObject(val)) {
                throw new Error('Invalid parameter rdkafka_options, it must be an object');
            }
        }
    }
};

export default class Schema extends ConvictSchema<KafkaReaderAPIConfig> {
    // This validation function is a workaround for the limitations of convict when
    // parsing configs that have periods `.` within its key values.
    // https://github.com/mozilla/node-convict/issues/250
    // This will pull `rdkafka_options` out before convict validation
    // https://github.com/terascope/kafka-assets/pull/1071
    validate(config: Record<string, any>): any {
        const { rdkafka_options, ...parsedConfig } = config;
        const results = super.validate(parsedConfig);

        return {
            ...results,
            rdkafka_options
        };
    }

    build(): Record<string, any> {
        return schema;
    }
}
