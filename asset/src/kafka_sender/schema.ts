import {
    ConvictSchema, ValidatedJobConfig, getOpConfig, get
} from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';

function fetchConfig(job: ValidatedJobConfig) {
    const opConfig = getOpConfig(job, 'kafka_sender');
    if (opConfig == null) throw new Error('Could not find elasticsearch_bulk operation in jobConfig');
    return opConfig as KafkaSenderConfig;
}

export default class Schema extends ConvictSchema<KafkaSenderConfig> {
    validateJob(job: ValidatedJobConfig) {
        const opConfig = fetchConfig(job);
        const kafkaConnectors = get(this.context, 'sysconfig.terafoundation.connectors.kafka');
        if (kafkaConnectors == null) throw new Error('Could not find kafka connector in terafoundation config');

        // check to verify if connection map provided is
        // consistent with sysconfig.terafoundation.connectors
        if (opConfig.connection_map) {
            for (const [, value] of Object.entries(opConfig.connection_map)) {
                if (!kafkaConnectors[value]) {
                    throw new Error(`A connection for [${value}] was set on the elasticsearch_bulk connection_map but is not found in the system configuration [terafoundation.connectors.elasticsearch]`);
                }
            }
        }
    }
    build() {
        return {
            topic: {
                doc: 'Name of the Kafka topic to send data to',
                default: '',
                format: 'required_String'
            },
            connection_map: {
                doc: 'Mapping from ID prefix to connection names. Routes data to multiple topics '
                + 'based on the incoming partition metadata. The key name can be a '
                + 'comma separated list of prefixes that will map to the same connection. Prefixes matching takes '
                + 'the first character of the key.',
                default: {
                    '*': 'default'
                },
                format: Object
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
            }
        };
    }
}
