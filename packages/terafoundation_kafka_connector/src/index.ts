import { Logger } from '@terascope/job-components';
import kafka from 'node-rdkafka';
import schema from './schema.js';
import {
    KafkaConnectorConfig,
    KafkaConsumerSettings,
    KafkaProducerSettings,
    KafkaConsumerResult,
    KafkaProducerResult,
    ClientType,
    RDKafkaOptions
} from './interfaces.js';

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
            } = this._getConsumerOptions(config, settings);

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
            } = this._getProducerOptions(config, settings);

            const client = new kafka.Producer(clientOptions, topicOptions);
            client.setPollInterval(pollInterval);

            await this._autoconnect(client, logger, settings.autoconnect);
            return {
                client,
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
            } = this._getConsumerOptions(config, settings);

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
            } = this._getProducerOptions(config, settings);

            const client = new kafka.Producer(clientOptions, topicOptions);
            client.setPollInterval(pollInterval);

            this._autoconnect(client, logger, settings.autoconnect);
            return {
                client,
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

    private _getConsumerOptions(config: KafkaConnectorConfig, settings: KafkaConsumerSettings) {
        // Group can be passed in when the connection is requested by the
        // application or configured in terafoundation config.
        const { group } = settings.options;

        const clientOptions = this._getClientOptions(config, {
            'group.id': group,
        }, settings.rdkafka_options);

        // Topic specific options as defined by librdkafka
        const topicOptions: RDKafkaOptions = Object.assign({
            'auto.offset.reset': 'smallest'
        }, settings.topic_options);

        return {
            // Topic specific options as defined by librdkafka
            topicOptions,
            clientOptions,
            group
        };
    }

    private _getProducerOptions(config: KafkaConnectorConfig, settings: KafkaProducerSettings) {
        const pollInterval = settings.options.poll_interval;

        const clientOptions = this._getClientOptions(config, {
            'queue.buffering.max.messages': 500000,
            'queue.buffering.max.ms': 1000,
            'batch.num.messages': 100000,
        }, settings.rdkafka_options);

        // Topic specific options as defined by librdkafka
        const topicOptions: RDKafkaOptions = Object.assign({}, settings.topic_options);

        return {
            topicOptions,
            clientOptions,
            pollInterval: pollInterval != null ? pollInterval : 100,
        };
    }

    // Default settings for the client. This uses the options we defined
    // before exposing all the settings available to rdkafka
    private _getClientOptions(config: KafkaConnectorConfig, ...options: any[]): RDKafkaOptions {
        const clientConfig = Object.assign({
            'metadata.broker.list': config.brokers,
            'security.protocol': config.security_protocol,
            'ssl.crl.location': config.ssl_crl_location,
            'ssl.ca.location': config.ssl_ca_location,
            'ssl.certificate.location': config.ssl_certificate_location,
            'ssl.key.location': config.ssl_key_location,
            'ssl.key.password': config.ssl_key_password,
        }, ...options);

        for (const [key, val] of Object.entries(clientConfig)) {
            if (val == null || val === '') {
                delete clientConfig[key];
            }
        }

        return clientConfig;
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
