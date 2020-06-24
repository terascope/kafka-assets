import {
    ConvictSchema, AnyObject, isPlainObject
} from '@terascope/job-components';

export default class Schema extends ConvictSchema<AnyObject> {
    build(): Record<string, any> {
        return {
            topic: {
                doc: 'Name of the Kafka topic to send data to',
                default: '',
                format: 'optional_String'
            },
            connection_map: {
                doc: 'Mapping from ID prefix to connection names. Routes data to multiple topics '
                + 'based on the incoming partition metadata. The key name can be a '
                + 'comma separated list of prefixes that will map to the same connection.',
                default: null,
                format: (val: any) => {
                    if (val !== null) {
                        if (!isPlainObject(val)) throw new Error('Invalid parameter, connection_map must be an object');
                    }
                }
            },
            id_field: {
                doc: 'Field in the incoming record that contains keys',
                default: '',
                format: String
            },
            timestamp_field: {
                doc: 'Field in the incoming record that contains a timestamp to set on the record',
                default: '',
                format: String
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
                format: Number
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
            },
            api_name: {
                doc: 'Name of kafka api used for reader, if none is provided, then one is made and the name is kafka_reader_api, and is injected into the execution',
                default: null,
                format: 'optional_String'
            },
        };
    }
}
