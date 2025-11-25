import {
    KafkaConnectorConfig,
    KafkaConsumerSettings,
    KafkaProducerSettings,
    RDKafkaOptions
} from './interfaces.js';

export function getConsumerOptions(config: KafkaConnectorConfig, settings: KafkaConsumerSettings) {
    // Group can be passed in when the connection is requested by the
    // application or configured in terafoundation config.
    const { group } = settings.options;

    const clientOptions = getClientOptions(config, {
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

export function getProducerOptions(config: KafkaConnectorConfig, settings: KafkaProducerSettings) {
    const pollInterval = settings.options.poll_interval;

    const clientOptions = getClientOptions(config, {
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
export function getClientOptions(config: KafkaConnectorConfig, ...options: any[]): RDKafkaOptions {
    const clientConfig = Object.assign({
        'metadata.broker.list': config.brokers,
        'security.protocol': config.security_protocol,
        'ssl.crl.location': config.ssl_crl_location,
        'ssl.ca.location': config.ssl_ca_location,
        'ssl.ca.pem': config.caCertificate,
        'ssl.certificate.location': config.ssl_certificate_location,
        'ssl.key.location': config.ssl_key_location,
        'ssl.key.password': config.ssl_key_password,
    }, config.rdkafka_options, ...options);

    for (const [key, val] of Object.entries(clientConfig)) {
        if (val == null || val === '') {
            delete clientConfig[key];
        }
    }

    return clientConfig;
}
