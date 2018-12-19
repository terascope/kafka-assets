import { KafkaConsumer, Producer } from 'node-rdkafka';

export interface KafkaConnectorConfig {
    group?: string;
    brokers: string[]|string;
}

export interface KafkaClientSettings {
    autoconnect?: boolean;
}

export interface RDKafkaOptions {
    [key: string]: string|number|boolean|Function;
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

export interface KafkaClientOptions {
    type: ClientType;
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
