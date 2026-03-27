import { SchemaValidator } from '@terascope/core-utils';

type E2EConfig = {
    TERASLICE_HOST: string;
    ASSET_ZIP_PATH: string;
    KAFKA_BROKERS: string;
};

const schema = {
    TERASLICE_HOST: {
        default: null,
        format: String,
        env: 'TERASLICE_HOST'
    },
    ASSET_ZIP_PATH: {
        default: null,
        format: String,
        env: 'ASSET_ZIP_PATH'
    },
    KAFKA_BROKERS: {
        default: 'localhost:9092',
        format: 'optional_string' as const,
        env: 'KAFKA_BROKERS'
    }
};

const validator = new SchemaValidator<E2EConfig>(schema, 'e2e-config');

export default validator.validate({});
