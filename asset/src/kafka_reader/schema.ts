import { ConvictSchema, ValidatedJobConfig } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces.js';

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

        if (!opConfig._api_name) throw new Error('"_api_name" is required in the kafka_reader config');
    }

    build(): Record<string, any> {
        return {};
    }
}
