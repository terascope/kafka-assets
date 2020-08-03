import {
    ConvictSchema, AnyObject, cloneDeep
} from '@terascope/job-components';
import { schema } from '../kafka_sender/schema';

const { api_name, ...newSchema } = schema;

const apiSchema = cloneDeep(newSchema);
apiSchema.topic.format = 'required_String';

export default class Schema extends ConvictSchema<AnyObject> {
    build(): Record<string, any> {
        return apiSchema;
    }
}
