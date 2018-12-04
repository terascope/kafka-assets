import { OpConfig } from '@terascope/job-components';

export interface KafkaSenderConfig extends OpConfig {
    /**
     Name of the Kafka topic to send data to
    */
    topic: string;
    /**
     Field in the incoming record that contains keys
    */
    id_field: string;
    /**
     Field in the incoming record that contains a timestamp to set on the record
    */
    timestamp_field: string;
    /**
     Set to true to have a timestamp generated as records are added to the topic
    */
    timestamp_now: boolean|string;
    /**
     The Kafka producer connection to use
    */
    connection: string;
    /**
     Type of compression to use
    */
    compression: 'none'|'gzip'|'snappy'|'lz4';
    /**
     How often the producer will poll the broker for metadata information.
     Set to -1 to disable polling.
    */
    metadata_refresh: number;
}

export interface CollectConfig extends OpConfig {
    wait: number;
    size: number;
}
