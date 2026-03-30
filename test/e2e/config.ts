import { SchemaValidator } from '@terascope/core-utils';

type E2EConfig = {
    TERASLICE_HOST: string;
    ASSET_ZIP_PATH: string;
    KAFKA_BROKER: string;
};

const schema = {
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
    }
};

const validator = new SchemaValidator<E2EConfig>(schema, 'e2e-config');

export default validator.validate(process.env);
