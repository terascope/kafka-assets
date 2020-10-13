import { ConvictSchema, ValidatedJobConfig } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';
import { DEFAULT_API_NAME } from '../kafka_reader_api/schema';

const schema = {
    api_name: {
        doc: 'Name of kafka api used for reader, if none is provided, then one is made and the name is kafka_reader_api, and is injected into the execution',
        default: null,
        format: 'optional_String'
    }
};

export default class Schema extends ConvictSchema<KafkaReaderConfig> {
    validateJob(job: ValidatedJobConfig): void {
        let opIndex = 0;

        const opConfig = job.operations.find((op, ind) => {
            if (op._op === 'kafka_reader') {
                opIndex = ind;
                return op;
            }
            return false;
        });

        if (opConfig == null) throw new Error('Could not find kafka_reader operation in jobConfig');

        const secondOp = job.operations[opIndex + 1] && job.operations[opIndex + 1]._op;

        if (secondOp === 'json_protocol') throw new Error('Kafka Reader handles serialization, please remove "json_protocol"');

        const {
            api_name, ...newConfig
        } = opConfig;

        const apiName = api_name || `${DEFAULT_API_NAME}:${opConfig._op}-${opIndex}`;

        // we set the new apiName back on the opConfig so it can reference the unique name
        opConfig.api_name = apiName;

        this.ensureAPIFromConfig(apiName, job, newConfig);
    }

    build(): Record<string, any> {
        return schema;
    }
}
