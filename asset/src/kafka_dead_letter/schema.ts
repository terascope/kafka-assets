import { ConvictSchema } from '@terascope/job-components';
import { KafkaDeadLetterConfig } from './interfaces.js';

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
            max_buffer_size: {
                doc: 'Maximum number of messages allowed on the producer queue',
                default: 100000,
                format: Number
            },
            max_buffer_kbytes_size: {
                doc: 'Maximum total message size sum in kilobytes allowed on the producer queue.',
                default: 1048576,
                format: Number
            },
            metadata_refresh: {
                doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
                default: 300000,
                format: Number
            }
        };
    }
}
