import { Logger } from '@terascope/core-utils';
import schema from './schema.js';
import { createClient as createKafkaClient } from './client/index.js';
import {
    KafkaConnectorConfig,
} from './interfaces.js';

const connector = {
    async createClient(
        customConfig: KafkaConnectorConfig,
        systemLogger: Logger,
        settings: any
    ) {
        const { client, logger } = await createKafkaClient(customConfig, systemLogger, settings);
        return { client, logger };
    },
    config_schema() {
        return schema;
    }
};

export default connector;
export * from './interfaces.js';
export * from './test-helpers/index.js';
export * from './client/index.js';
