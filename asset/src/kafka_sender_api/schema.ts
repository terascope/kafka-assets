import {
    ConvictSchema,
    AnyObject,
    isNumber,
    getTypeOf
} from '@terascope/job-components';

export const DEFAULT_API_NAME = 'kafka_sender_api';

export const schema = {
    topic: {
        doc: 'Name of the Kafka topic to send data to',
        default: null,
        format: 'required_String'
    },
    id_field: {
        doc: 'Field in the incoming record that contains keys',
        default: null,
        format: 'optional_String'
    },
    timestamp_field: {
        doc: 'Field in the incoming record that contains a timestamp to set on the record',
        default: null,
        format: 'optional_String'
    },
    timestamp_now: {
        doc: 'Set to true to have a timestamp generated as records are added to the topic',
        default: false,
        format: Boolean
    },
    connection: {
        doc: 'The Kafka producer connection to use.',
        default: 'default',
        format: String
    },
    compression: {
        doc: 'Type of compression to use',
        default: 'gzip',
        format: ['none', 'gzip', 'snappy', 'lz4', 'inherit']
    },
    wait: {
        doc: 'How long to wait for `size` messages to become available on the producer.',
        default: 500,
        format: 'duration'
    },
    size: {
        doc: 'How many messages will be batched and sent to kafka together.',
        default: 10000,
        format: (val: unknown):void => {
            if (isNumber(val)) {
                if (val <= 0) throw new Error('Invalid parameter size, it must be a positive number');
            } else {
                throw new Error(`Invalid parameter size, it must be a number, got ${getTypeOf(val)}`);
            }
        }
    },
    max_buffer_size: {
        doc: 'Maximum number of messages allowed on the producer queue',
        default: 250000,
        format: (val: unknown):void => {
            if (isNumber(val)) {
                if (val <= 0) throw new Error('Invalid parameter max_buffer_size, it must be a positive number');
            } else {
                throw new Error(`Invalid parameter max_buffer_size, it must be a number, got ${getTypeOf(val)}`);
            }
        }
    },
    metadata_refresh: {
        doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
        default: '5 minutes',
        format: 'duration'
    },
    partition_assignment_strategy: {
        doc: 'Name of partition assignment strategy to use when elected group leader assigns partitions to group members.',
        default: '',
        format: ['range', 'roundrobin', '']
    },
    required_acks: {
        doc: 'The number of required broker acknowledgements for a given request, set to -1 for all.',
        default: 1,
        format: 'int'
    }
};

export default class Schema extends ConvictSchema<AnyObject> {
    build(): Record<string, any> {
        return schema;
    }
}
