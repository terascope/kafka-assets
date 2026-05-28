import { debugLogger } from '@terascope/core-utils';
import { createClient } from '../client/index.js';
import { connectorConfig } from './config.js';
import {
    KafkaConnectorConfig, KafkaAdminSettings, KafkaConsumerSettings,
    KafkaProducerSettings
} from '../interfaces.js';

export async function makeAdminClient(config: KafkaConnectorConfig, logger = debugLogger('test')) {
    const settings: KafkaAdminSettings = {
        options: { type: 'admin' },
        ...config?.rdkafka_options && { rdkafka_options: config.rdkafka_options }
    };
    return createClient(connectorConfig, logger, settings);
}

export async function makeConsumerClient(config: KafkaConnectorConfig, logger = debugLogger('test')) {
    const settings: KafkaConsumerSettings = {
        options: { type: 'consumer' },
        ...config?.rdkafka_options && { rdkafka_options: config.rdkafka_options }
    };
    return createClient(connectorConfig, logger, settings);
}

export async function makeProducerClient(config: KafkaConnectorConfig, logger = debugLogger('test')) {
    const settings: KafkaProducerSettings = {
        options: { type: 'producer' },
        ...config?.rdkafka_options && { rdkafka_options: config.rdkafka_options }
    };
    return createClient(connectorConfig, logger, settings);
}
