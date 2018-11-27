export interface KafkaConnectorConfig {
    group?: string;
    brokers: string[]|string;
}

export interface KafkaClientSettings {
    options: KafkaClientOptions;
    topic_options: any;
    rdkafka_options: any;
    autoconnect: boolean;
}

export interface KafkaClientOptions {
    type: string;
    connection: string;
    group?: string;
    poll_interval?: number;
}
