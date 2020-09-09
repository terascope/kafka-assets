import { ConvictSchema } from '@terascope/job-components';
import { KafkaDeadLetterConfig } from './interfaces';

export default class Schema extends ConvictSchema<KafkaDeadLetterConfig> {
    build(): Record<string, any> {
        return {
            topic: {
                doc: 'Name of the Kafka topic to send data to',
                default: null,
                format: 'required_String'
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
                format: Number
            },
            size: {
                doc: 'How many messages will be batched and sent to kafka together.',
                default: 10000,
                format: Number
            },
            metadata_refresh: {
                doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
                default: 300000,
                format: Number
            },
            partition_assignment_strategy: {
                doc: 'Name of partition assignment strategy to use when elected group leader assigns partitions to group members.',
                default: '',
                format: ['range', 'roundrobin', '']
            }
        };
    }
}
