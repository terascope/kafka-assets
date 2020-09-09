import {
    ConvictSchema,
    ValidatedJobConfig,
    getOpConfig,
    get,
    isNil,
    isNotNil,
    isNumber,
    getTypeOf
} from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';

function fetchConfig(job: ValidatedJobConfig) {
    const opConfig = getOpConfig(job, 'kafka_sender');
    if (opConfig == null) throw new Error('Could not find kafka_sender operation in jobConfig');
    return opConfig as KafkaSenderConfig;
}

const DEFAULT_API_NAME = 'kafka_sender_api';

export const schema = {
    topic: {
        doc: 'Name of the Kafka topic to send data to',
        default: null,
        format: 'optional_String'
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
        default: DEFAULT_API_NAME,
        format: 'required_String'
    },
};

export default class Schema extends ConvictSchema<KafkaSenderConfig> {
    validateJob(job: ValidatedJobConfig): void {
        const opConfig = fetchConfig(job);
        const kafkaConnectors = get(this.context, 'sysconfig.terafoundation.connectors.kafka');
        if (kafkaConnectors == null) throw new Error('Could not find kafka connector in terafoundation config');

        const { api_name, ...apiConfig } = opConfig;
        const kafkaSenderAPI = job.apis.find((jobApi) => jobApi._name === DEFAULT_API_NAME);

        if (kafkaSenderAPI) {
            if (isNotNil(opConfig.topic)) throw new Error('Cannot specify topic and group in kafka_reader if you have specified an kafka_reader_api');
        } else {
            if (isNil(apiConfig.topic)) throw new Error('Parameter topic needs to be defined in operation');

            job.apis.push({
                _name: DEFAULT_API_NAME,
                ...apiConfig
            });
        }
    }

    build(): Record<string, any> {
        return schema;
    }
}
