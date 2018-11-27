// @ts-ignore
import bunyan from '@types/bunyan';
import { KafkaConsumer, Producer } from 'node-rdkafka';
import { KafkaConnectorConfig, KafkaClientSettings } from './interfaces';
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
function create(config: KafkaConnectorConfig, logger: bunyan, settings: KafkaClientSettings) {
    let client;
    const clientType = settings.options.type.toLowerCase();

    if (clientType === 'consumer') {
        // Group can be passed in when the connection is requested by the
        // application or configured in terafoundation config.
        let group = settings.options.group;
        if (!group) group = config.group;

        // Default settings for the client. This uses the options we defined
        // before exposing all the settings available to rdkafka
        let clientOptions = {
            'group.id': group,
            'metadata.broker.list': config.brokers,
        };

        // Topic specific options as defined by librdkafka
        let topicOptions = {
            'auto.offset.reset': 'smallest'
        };

        topicOptions = Object.assign(topicOptions, settings.topic_options);

        // Merge in any librdkafka options passed in by the user.
        clientOptions = Object.assign(clientOptions, settings.rdkafka_options);

        logger.info(`Creating a Kafka consumer for group: ${group}`);
        client = new KafkaConsumer(clientOptions, topicOptions);
    } else if (clientType === 'producer') {
        // Default settings for the client. This uses the options we defined
        // before exposing all the settings available to rdkafka
        let clientOptions = {
            'metadata.broker.list': config.brokers,
            'queue.buffering.max.messages': 500000,
            'queue.buffering.max.ms': 1000,
            'batch.num.messages': 100000,
        };

        // Topic specific options as defined by librdkafka
        let topicOptions = {};

        topicOptions = Object.assign(topicOptions, settings.topic_options);

        // Merge in any librdkafka options passed in by the user.
        clientOptions = Object.assign(clientOptions, settings.rdkafka_options);

        client = new Producer(clientOptions, topicOptions);

        let pollInterval = 100;
        if (settings.options.poll_interval) pollInterval = settings.options.poll_interval;
        client.setPollInterval(pollInterval);
    } else {
        throw new Error(`Unsupport client type of ${clientType}`);
    }

    // Default to autoconnecting but can be disabled.
    if (settings.autoconnect || settings.autoconnect == null) {
        client.connect({}, (err) => {
            if (err) {
                logger.error(`Error connecting to Kafka: ${err}`);
                throw err;
            } else {
                logger.info('Kafka connection initialized.');
            }
        });
    }

    return {
        client
    };
}

function configSchema() {
    return {
        brokers: {
            doc: 'List of seed brokers for the kafka environment',
            default: ['localhost:9092'],
            format: Array
        }
    };
}

export = {
    create,
    config_schema: configSchema
};
