import { Logger } from '@terascope/job-components';
import { KafkaConsumer, Producer } from 'node-rdkafka';
import {
    KafkaConnectorConfig,
    KafkaConsumerSettings,
    KafkaProducerSettings,
    KafkaConsumerResult,
    KafkaProducerResult,
    ClientType,
    RDKafkaOptions
} from './interfaces';

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

class KafakConnector {
    create(config: KafkaConnectorConfig, logger: Logger, settings: KafkaConsumerSettings): KafkaConsumerResult;
    create(config: KafkaConnectorConfig, logger: Logger, settings: KafkaProducerSettings): KafkaProducerResult;
    create(config: KafkaConnectorConfig, logger: Logger, settings: KafkaConsumerSettings|KafkaProducerSettings): KafkaConsumerResult|KafkaProducerResult {
        const clientType = getClientType(settings.options.type);

        if (isConsumerSettings(settings)) {
            const {
                topicOptions,
                clientOptions,
                group
            } = this._getConsumerOptions(config, settings);

            logger.info(`Creating a Kafka consumer for group: ${group}`);
            const client = new KafkaConsumer(clientOptions, topicOptions);

            this._autoconnect(client, logger, settings.autoconnect);
            return {
                client,
            };
        }

        if (isProducerSettings(settings)) {
            const {
                topicOptions,
                clientOptions,
                pollInterval
            } = this._getProducerOptions(config, settings);

            const client = new Producer(clientOptions, topicOptions);
            client.setPollInterval(pollInterval);

            this._autoconnect(client, logger, settings.autoconnect);
            return {
                client,
            };
        }

        throw new Error(`Unsupport client type of ${clientType}`);
    }

    config_schema() {
        return {
            brokers: {
                doc: 'List of seed brokers for the kafka environment',
                default: ['localhost:9092'],
                format: Array
            }
        };
    }

    private _autoconnect(client: Producer|KafkaConsumer, logger: Logger, autoconnect: boolean = true) {
        if (!autoconnect) return;

        // Default to autoconnecting but can be disabled.
        client.connect({}, (err) => {
            if (err) {
                logger.error('Error connecting to Kafka', err);
                throw err;
            } else {
                logger.info('Kafka connection initialized.');
            }
        });
    }

    private _getConsumerOptions(config: KafkaConnectorConfig, settings: KafkaConsumerSettings) {
        // Group can be passed in when the connection is requested by the
        // application or configured in terafoundation config.
        const group = settings.options.group || config.group;

        // Default settings for the client. This uses the options we defined
        // before exposing all the settings available to rdkafka
        const clientOptions: RDKafkaOptions = Object.assign({
            'group.id': group,
            'metadata.broker.list': config.brokers,
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
        // Default settings for the client. This uses the options we defined
        // before exposing all the settings available to rdkafka
        const clientOptions: RDKafkaOptions = Object.assign({
            'metadata.broker.list': config.brokers,
            'queue.buffering.max.messages': 500000,
            'queue.buffering.max.ms': 1000,
            'batch.num.messages': 100000,
        }, settings.rdkafka_options);

        // Topic specific options as defined by librdkafka
        const topicOptions: RDKafkaOptions = Object.assign({}, settings.topic_options);

        const { poll_interval = 100 } = settings.options;

        return {
            topicOptions,
            clientOptions,
            pollInterval: poll_interval,
        };
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

export = new KafakConnector();
