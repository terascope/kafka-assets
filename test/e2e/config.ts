import { SchemaValidator } from '@terascope/core-utils';
import { Terafoundation } from '@terascope/types';

type E2EConfig = {
    TERASLICE_HOST: string;
    ASSET_ZIP_PATH: string;
    KAFKA_BROKER: string;
    TEST_TERASLICE: boolean;
};

const schema: Terafoundation.Schema<any> = {
    TERASLICE_HOST: {
        default: null,
        format: 'required_string'
    },
    ASSET_ZIP_PATH: {
        default: null,
        format: 'required_string'
    },
    KAFKA_BROKER: {
        default: null,
        format: 'required_string'
    },
    TEST_TERASLICE: {
        default: false,
        format: Boolean,
    },
};

const validator = new SchemaValidator<E2EConfig>(schema, 'e2e-config', undefined, 'allow');

export default validator.validate(process.env);
