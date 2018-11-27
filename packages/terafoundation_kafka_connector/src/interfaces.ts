import { KafkaConsumer, Producer } from 'node-rdkafka';
import {
    RDKafkaConsumerOptions,
    RDKafkaProducerOptions,
    RDKafkaConsumerTopicOptions,
    RDKafkaProducerTopicOptions,
} from './rdkafka-options';

export interface KafkaConnectorConfig {
    group?: string;
    brokers: string[]|string;
}

export interface KafkaClientSettings {
    autoconnect?: boolean;
}

export interface KafkaConsumerSettings extends KafkaClientSettings {
    options: KafkaConsumerOptions;
    topic_options?: RDKafkaConsumerTopicOptions;
    rdkafka_options?: RDKafkaConsumerOptions;
}

export interface KafkaProducerSettings extends KafkaClientSettings {
    options: KafkaProducerOptions;
    topic_options?: RDKafkaProducerTopicOptions;
    rdkafka_options?: RDKafkaProducerOptions;
}

export interface KafkaClientOptions {
    type: ClientType;
    connection?: string;
}

export interface KafkaProducerOptions extends KafkaClientOptions {
    poll_interval?: number;
}

export interface KafkaConsumerOptions extends KafkaClientOptions {
    group?: string;
}

export type ClientType = 'producer'|'consumer';

export interface KafkaConsumerResult {
    client: KafkaConsumer;
}

export interface KafkaProducerResult {
    client: Producer;
}
