import { Logger } from '@terascope/core-utils';
import kafka from '@confluentinc/kafka-javascript';
import {
    KafkaConnectorConfig,
    KafkaConsumerSettings,
    KafkaProducerSettings,
    KafkaConsumerResult,
    KafkaProducerResult,
    KafkaAdminSettings,
    KafkaAdminResult
} from '../interfaces.js';
import { getConsumerOptions, getProducerOptions, getAdminOptions } from '../utils.js';

/**
 * settings contains a list of options to configure on the client.
 *
 * {
 *     options: {} // Options for the connector
 *     rdkafka_options: {} // Options for the node-rdkafka object.
 *          Valid options here are as defined by rdkafka
 *     topic_options: {} // Options as defined for rdkafka that are topic specific
 *     autoconnect: true // Whether the client should autoconnect or not.
 * }
 *
 * rdkafka settings: https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
 */

export async function createClient(
    config: KafkaConnectorConfig,
    logger: Logger,
    settings: KafkaConsumerSettings
): Promise<KafkaConsumerResult>;
export async function createClient(
    config: KafkaConnectorConfig,
    logger: Logger,
    settings: KafkaProducerSettings
): Promise<KafkaProducerResult>;
export async function createClient(
    config: KafkaConnectorConfig,
    logger: Logger,
    settings: KafkaAdminSettings
): Promise<KafkaAdminResult>;
export async function createClient(
    config: KafkaConnectorConfig,
    logger: Logger,
    settings: KafkaConsumerSettings | KafkaProducerSettings | KafkaAdminSettings
): Promise<KafkaConsumerResult | KafkaProducerResult | KafkaAdminResult> {
    const clientType = getClientType(settings.options && settings.options.type);

    if (isConsumerSettings(settings)) {
        const {
            topicOptions,
            clientOptions,
            group
        } = getConsumerOptions(config, settings);

        logger.info(`Creating a Kafka consumer for group: ${group}`);
        const client = new kafka.KafkaConsumer(clientOptions, topicOptions);

        await _autoconnect(client, logger, settings.autoconnect);
        return {
            client,
            logger
        };
    }

    if (isProducerSettings(settings)) {
        const {
            topicOptions,
            clientOptions,
            pollInterval
        } = getProducerOptions(config, settings);

        const client = new kafka.Producer(clientOptions, topicOptions);
        client.setPollInterval(pollInterval);

        await _autoconnect(client, logger, settings.autoconnect);
        return {
            client,
            logger
        };
    }

    if (isAdminSettings(settings)) {
        const {
            clientOptions
        } = getAdminOptions(config, settings);

        const client = kafka.AdminClient.create(clientOptions);

        return {
            client,
            logger
        };
    }

    throw new Error(`Unsupported client type of ${clientType}`);
}

async function _autoconnect(
    client: kafka.Producer | kafka.KafkaConsumer,
    logger: Logger,
    autoconnect = true
) {
    if (!autoconnect) return;

    // Default to autoconnecting but can be disabled.
    client.connect({}, (err) => {
        if (err) {
            logger.error('Error connecting to Kafka', err);
            throw (err);
        } else {
            logger.info('Kafka connection initialized.');
        }
    });
}

function getClientType(input: string) {
    return input && input.toLowerCase();
}

function isConsumerSettings(settings: any): settings is KafkaConsumerSettings {
    return getClientType(settings.options.type) === 'consumer';
}

function isProducerSettings(settings: any): settings is KafkaProducerSettings {
    return getClientType(settings.options.type) === 'producer';
}

function isAdminSettings(settings: any): settings is KafkaAdminSettings {
    return getClientType(settings.options.type) === 'admin';
}
