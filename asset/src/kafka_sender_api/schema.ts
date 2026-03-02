import { BaseSchema } from '@terascope/job-components';
import {
    isNumber,
    getTypeOf,
    isPlainObject
} from '@terascope/core-utils';

export const DEFAULT_API_NAME = 'kafka_sender_api';

export const schema = {
    topic: {
        doc: 'Name of the Kafka topic to send data to',
        default: null,
        format: 'required_string'
    },
    id_field: {
        doc: 'Field in the incoming record that contains keys',
        default: null,
        format: 'optional_string'
    },
    timestamp_field: {
        doc: 'Field in the incoming record that contains a timestamp to set on the record',
        default: null,
        format: 'optional_string'
    },
    timestamp_now: {
        doc: 'Set to true to have a timestamp generated as records are added to the topic',
        default: false,
        format: Boolean
    },
    _connection: {
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
        default: undefined,
        format: (val: unknown): void => {
            if (isNumber(val)) {
                if (val < 0) throw new Error('Invalid parameter max_buffer_size, it must be a positive number, or 0');
            } else if (val !== undefined) {
                throw new Error(`Invalid parameter max_buffer_size, it must be a number or undefined, got ${getTypeOf(val)}`);
            }
        }
    },
    max_buffer_kbytes_size: {
        doc: 'Maximum total message size sum in kilobytes allowed on the producer queue.',
        default: undefined,
        format: (val: unknown): void => {
            if (isNumber(val)) {
                if (val <= 0) throw new Error('Invalid parameter max_buffer_kbytes_size, it must be a positive number');
            } else if (val !== undefined) {
                throw new Error(`Invalid parameter max_buffer_kbytes_size, it must be a number or undefined, got ${getTypeOf(val)}`);
            }
        }
    },
    metadata_refresh: {
        doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
        default: '5 minutes',
        format: 'duration'
    },
    required_acks: {
        doc: 'The number of required broker acknowledgements for a given request, set to 1 for leader only, -1 for all, 0 for none.',
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
    },
    delivery_report: {
        doc: 'Configure actions to take when receiving delivery reports for each message.'
            + ' Either the `dr_cb` or `dr_msg_cb` option must be set to true within `rdkafka_options`'
            + ' to receive delivery reports.',
        default: undefined,
        format: (val: any) => {
            if (!val) return;
            if (!isPlainObject(val)) {
                throw new Error('Invalid parameter delivery_report, it must be an object if defined');
            }
            if (typeof val.wait !== 'boolean') {
                throw new Error('Invalid parameter delivery_report.wait, it must be a boolean');
            }
            if (typeof val.error_only !== 'boolean') {
                throw new Error('Invalid parameter delivery_report.error_only, it must be a boolean');
            }
            if (typeof val.on_error !== 'string' || !['log', 'throw', 'ignore'].includes(val.on_error)) {
                throw new Error('Invalid parameter delivery_report.on_error, it must be one of [\'log\', \'throw\', \'ignore\']');
            }
        }
    }
};

export default class Schema extends BaseSchema<Record<string, any>> {
    build(): Record<string, any> {
        return schema;
    }
}
