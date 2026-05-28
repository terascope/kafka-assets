import { Logger } from '@terascope/core-utils';
import kafka, { IAdminClient } from '@confluentinc/kafka-javascript';

export interface KafkaConnectorConfig {
    /** A list of brokers */
    brokers: string[] | string;

    /** The security protocol to use */
    security_protocol?: 'plaintext' | 'ssl';

    // SSL configuration
    caCertificate?: string;
    ssl_ca_location?: string;
    ssl_certificate_location?: string;
    ssl_crl_location?: string;
    ssl_key_location?: string;
    ssl_key_password?: string;

    // Additional rdkafka configuration options
    rdkafka_options?: RDKafkaOptions;
}

export interface KafkaClientSettings {
    autoconnect?: boolean;
}

export interface RDKafkaOptions {
    [key: string]: string | number | boolean | ((...args: any[]) => any);
}
export interface KafkaConsumerSettings extends KafkaClientSettings {
    options: KafkaConsumerOptions;
    topic_options?: RDKafkaOptions;
    rdkafka_options?: RDKafkaOptions;
}

export interface KafkaProducerSettings extends KafkaClientSettings {
    options: KafkaProducerOptions;
    topic_options?: RDKafkaOptions;
    rdkafka_options?: RDKafkaOptions;
}

export interface KafkaAdminSettings extends KafkaClientSettings {
    options: { type: 'admin' };
    rdkafka_options?: RDKafkaOptions;
}
export interface KafkaProducerOptions {
    type: 'producer';
    poll_interval?: number;
}

export interface KafkaConsumerOptions {
    type: 'consumer';
    group?: string;
}

export interface KafkaConsumerResult {
    client: kafka.KafkaConsumer;
    logger: Logger;
}

export interface KafkaProducerResult {
    client: kafka.Producer;
    logger: Logger;
}

export interface KafkaAdminResult {
    client: IAdminClient;
    logger: Logger;
}
