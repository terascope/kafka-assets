import { ConvictSchema, ValidatedJobConfig } from '@terascope/job-components';
import { get } from '@terascope/core-utils';
import { KafkaSenderConfig } from './interfaces.js';

const schema = {
    _api_name: {
        doc: 'Name of kafka api used for sender, if none is provided, then one is made and the name is kafka_sender_api, and is injected into the execution',
        default: null,
        format: 'required_string'
    }
};

export default class Schema extends ConvictSchema<KafkaSenderConfig> {
    validateJob(job: ValidatedJobConfig): void {
        const opConfig = job.operations.find((op) => {
            if (op._op === 'kafka_sender') {
                return op;
            }
            return false;
        });

        if (opConfig == null) throw new Error('Could not find kafka_sender operation in jobConfig');

        const kafkaConnectors = get(this.context, 'sysconfig.terafoundation.connectors.kafka');
        if (kafkaConnectors == null) throw new Error('Could not find kafka connector in terafoundation config');
    }

    build(): Record<string, any> {
        return schema;
    }
}
