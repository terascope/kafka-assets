import { ConvictSchema, cloneDeep } from '@terascope/job-components';
import { KafkaReaderAPIConfig } from './interfaces';
import { schema } from '../kafka_reader/schema';

const { api_name, ...newSchema } = schema;

const apiSchema = cloneDeep(newSchema);
apiSchema.topic.format = 'required_String';
apiSchema.group.format = 'required_String';

export default class Schema extends ConvictSchema<KafkaReaderAPIConfig> {
    build(): Record<string, any> {
        return apiSchema;
    }
}
