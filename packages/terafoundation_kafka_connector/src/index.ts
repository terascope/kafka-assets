import { Logger } from '@terascope/core-utils';
import kafka from '@confluentinc/kafka-javascript';
import schema from './schema.js';
import {
    KafkaConnectorConfig,
    KafkaConsumerSettings,
    KafkaProducerSettings,
    KafkaConsumerResult,
    KafkaProducerResult,
    ClientType
} from './interfaces.js';
import * as configHelpers from './helpers.js';

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

class KafkaConnector {
    async createClient(
        config: KafkaConnectorConfig,
        logger: Logger,
        settings: KafkaConsumerSettings
    ): Promise<KafkaConsumerResult>;
    async createClient(
        config: KafkaConnectorConfig,
        logger: Logger,
        settings: KafkaProducerSettings
    ): Promise<KafkaProducerResult>;
    async createClient(
        config: KafkaConnectorConfig,
        logger: Logger,
        settings: KafkaConsumerSettings | KafkaProducerSettings
    ): Promise<KafkaConsumerResult | KafkaProducerResult> {
        const clientType = getClientType(settings.options && settings.options.type);

        if (isConsumerSettings(settings)) {
            const {
                topicOptions,
                clientOptions,
                group
            } = configHelpers.getConsumerOptions(config, settings);

            logger.info(`Creating a Kafka consumer for group: ${group}`);
            const client = new kafka.KafkaConsumer(clientOptions, topicOptions);

            await this._autoconnect(client, logger, settings.autoconnect);
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
            } = configHelpers.getProducerOptions(config, settings);

            const producerClient = new kafka.Producer(clientOptions, topicOptions);
            producerClient.setPollInterval(pollInterval);

            const adminClient = kafka.AdminClient.create(clientOptions);

            await this._autoconnect(producerClient, logger, settings.autoconnect);
            return {
                client: { producerClient, adminClient },
                logger
            };
        }

        throw new Error(`Unsupported client type of ${clientType}`);
    }

    // we are leaving this in so that the connector can work with older versions of
    // teraslice and older kafka assets since this is baked in the teraslice docker image
    create(
        config: KafkaConnectorConfig,
        logger: Logger,
        settings: KafkaConsumerSettings
    ): KafkaConsumerResult;
    create(
        config: KafkaConnectorConfig,
        logger: Logger,
        settings: KafkaProducerSettings
    ): KafkaProducerResult;
    create(
        config: KafkaConnectorConfig,
        logger: Logger,
        settings: KafkaConsumerSettings | KafkaProducerSettings
    ): KafkaConsumerResult | KafkaProducerResult {
        const clientType = getClientType(settings.options && settings.options.type);

        if (isConsumerSettings(settings)) {
            const {
                topicOptions,
                clientOptions,
                group
            } = configHelpers.getConsumerOptions(config, settings);

            logger.info(`Creating a Kafka consumer for group: ${group}`);
            const client = new kafka.KafkaConsumer(clientOptions, topicOptions);

            this._autoconnect(client, logger, settings.autoconnect);
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
            } = configHelpers.getProducerOptions(config, settings);

            const producerClient = new kafka.Producer(clientOptions, topicOptions);
            const adminClient = kafka.AdminClient.create(clientOptions);
            producerClient.setPollInterval(pollInterval);

            this._autoconnect(producerClient, logger, settings.autoconnect);
            return {
                client: { producerClient, adminClient },
                logger
            };
        }

        throw new Error(`Unsupport client type of ${clientType}`);
    }

    config_schema() {
        return schema;
    }

    private async _autoconnect(
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
}

function getClientType(input: string) {
    return input && input.toLowerCase() as ClientType;
}

function isConsumerSettings(settings: any): settings is KafkaConsumerSettings {
    return getClientType(settings.options.type) === 'consumer';
}

function isProducerSettings(settings: any): settings is KafkaProducerSettings {
    return getClientType(settings.options.type) === 'producer';
}

const connector = new KafkaConnector();

export default connector;
