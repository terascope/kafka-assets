import { BaseSchema, ValidatedJobConfig } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces.js';

const schema = {
    _api_name: {
        doc: 'Name of kafka api used for sender, if none is provided, then one is made and the name is kafka_sender_api, and is injected into the execution',
        default: null,
        format: 'required_string'
    }
};
export default class Schema extends BaseSchema<KafkaReaderConfig> {
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

        if (!opConfig._api_name) throw new Error('"_api_name" is required in the kafka_reader config');
    }

    build(): Record<string, any> {
        return schema;
    }
}
