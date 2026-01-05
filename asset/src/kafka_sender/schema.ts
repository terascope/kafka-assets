import { ConvictSchema } from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces.js';

const schema = {
    _api_name: {
        doc: 'Name of kafka api used for sender, if none is provided, then one is made and the name is kafka_sender_api, and is injected into the execution',
        default: null,
        format: 'required_string'
    }
};

export default class Schema extends ConvictSchema<KafkaSenderConfig> {
    build(): Record<string, any> {
        return schema;
    }
}
