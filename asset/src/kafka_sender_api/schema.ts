import {
    ConvictSchema,
    AnyObject,
    isNumber,
    getTypeOf,
    isPlainObject
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
        format: (val: unknown): void => {
            if (isNumber(val)) {
                if (val <= 0) throw new Error('Invalid parameter size, it must be a positive number');
            } else {
                throw new Error(`Invalid parameter size, it must be a number, got ${getTypeOf(val)}`);
            }
        }
    },
    max_buffer_size: {
        doc: 'Maximum number of messages allowed on the producer queue. A value of 0 disables this limit.',
        default: 100000,
        format: (val: unknown): void => {
            if (isNumber(val)) {
                if (val < 0) throw new Error('Invalid parameter max_buffer_size, it must be a positive number, or 0');
            } else {
                throw new Error(`Invalid parameter max_buffer_size, it must be a number, got ${getTypeOf(val)}`);
            }
        }
    },
    max_buffer_kbytes_size: {
        doc: 'Maximum total message size sum in kilobytes allowed on the producer queue.',
        default: 1048576,
        format: (val: unknown): void => {
            if (isNumber(val)) {
                if (val <= 0) throw new Error('Invalid parameter max_buffer_kbytes_size, it must be a positive number');
            } else {
                throw new Error(`Invalid parameter max_buffer_kbytes_size, it must be a number, got ${getTypeOf(val)}`);
            }
        }
    },
    metadata_refresh: {
        doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
        default: '5 minutes',
        format: 'duration'
    },
    required_acks: {
        doc: 'The number of required broker acknowledgements for a given request, set to -1 for all.',
        default: 1,
        format: 'int'
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

export default class Schema extends ConvictSchema<AnyObject> {
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
