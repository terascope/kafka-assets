import { APIConfig } from '@terascope/job-components';

export interface KafkaDeadLetterConfig extends APIConfig {
    /**
     Name of the Kafka topic to send data to
    */
    topic: string;
    /**
     The Kafka producer connection to use
    */
    connection: string;
    /**
     Type of compression to use
    */
    compression: 'none'|'gzip'|'snappy'|'lz4'|'inherit';
    /**
     How long to wait for `size` messages to become available on the producer
    */
    wait: number;
    /**
     How many messages will be batched and sent to kafka together
    */
    size: number;
    /**
     How often the producer will poll the broker for metadata information.
     Set to -1 to disable polling.
    */
    metadata_refresh: number;
}