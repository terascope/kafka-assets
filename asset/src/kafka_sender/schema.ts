import path from 'path';
import { ConvictSchema, JobConfig } from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';
import { getCollectConfig } from './utils';

export default class Schema extends ConvictSchema<KafkaSenderConfig> {
    validateJob(job: JobConfig) {
        const opName = path.basename(__dirname);

        const kafkaSender = job.operations.find((op) => {
            return op._op === opName;
        });

        getCollectConfig(job.operations, kafkaSender as KafkaSenderConfig);
    }

    build() {
        return {
            topic: {
                doc: 'Name of the Kafka topic to send data to',
                default: '',
                format: 'required_String'
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
                default: '',
                format: String
            },
            connection: {
                doc: 'The Kafka producer connection to use.',
                default: 'default',
                format: String
            },
            compression: {
                doc: 'Type of compression to use',
                default: 'gzip',
                format: ['none', 'gzip', 'snappy', 'lz4']
            },
            metadata_refresh: {
                doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
                default: 300000,
                format: Number
            }
        };
    }
}
