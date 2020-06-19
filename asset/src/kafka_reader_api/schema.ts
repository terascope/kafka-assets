import {
    ConvictSchema, AnyObject,
} from '@terascope/job-components';

export default class Schema extends ConvictSchema<AnyObject> {
    build(): AnyObject {
        return {
            size: {
                doc: 'the maximum number of docs it will take at a time, anything past it will be split up and sent'
                + 'note that the value should be even, the first doc will be the index data and then the next is the data',
                default: 500,
                format(val: any) {
                    if (isNaN(val)) {
                        throw new Error('Invalid size parameter for elasticsearch_bulk opConfig, it must be a number');
                    } else if (val <= 0) {
                        throw new Error('Invalid size parameter for elasticsearch_bulk, it must be greater than zero');
                    }
                }
            },
            connection: {
                doc: 'Name of the elasticsearch connection to use when sending data.',
                default: 'default',
                format: 'optional_String'
            },
            full_response: {
                doc: 'Set to true if want the full elasticsearch response back',
                default: false,
                format: Boolean
            },
        };
    }
}
