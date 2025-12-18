import { ConvictSchema, ValidatedJobConfig } from '@terascope/job-components';
import { get } from '@terascope/core-utils';
import { KafkaSenderConfig } from './interfaces.js';

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

        if (!opConfig._api_name) throw new Error('"_api_name" is required in the kafka_sender config');

        const kafkaConnectors = get(this.context, 'sysconfig.terafoundation.connectors.kafka');
        if (kafkaConnectors == null) throw new Error('Could not find kafka connector in terafoundation config');
    }

    build(): Record<string, any> {
        return {};
    }
}
