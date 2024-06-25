import { ConvictSchema, ValidatedJobConfig, get } from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces.js';
import { DEFAULT_API_NAME } from '../kafka_sender_api/schema.js';

const schema = {
    api_name: {
        doc: 'Name of kafka api used for sender, if none is provided, then one is made and the name is kafka_sender_api, and is injected into the execution',
        default: null,
        format: 'optional_String'
    }
};

export default class Schema extends ConvictSchema<KafkaSenderConfig> {
    validateJob(job: ValidatedJobConfig): void {
        let opIndex = 0;

        const opConfig = job.operations.find((op, ind) => {
            if (op._op === 'kafka_sender') {
                opIndex = ind;
                return op;
            }
            return false;
        });

        if (opConfig == null) throw new Error('Could not find kafka_sender operation in jobConfig');

        const {
            api_name, ...newConfig
        } = opConfig;

        const apiName = api_name || `${DEFAULT_API_NAME}:${opConfig._op}-${opIndex}`;

        // we set the new apiName back on the opConfig so it can reference the unique name
        opConfig.api_name = apiName;

        this.ensureAPIFromConfig(apiName, job, newConfig);

        const kafkaConnectors = get(this.context, 'sysconfig.terafoundation.connectors.kafka');
        if (kafkaConnectors == null) throw new Error('Could not find kafka connector in terafoundation config');
    }

    build(): Record<string, any> {
        return schema;
    }
}
