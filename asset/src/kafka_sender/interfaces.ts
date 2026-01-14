import { OpConfig } from '@terascope/types';

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
    timestamp_now: boolean;
    /**
     The Kafka producer connection to use
    */
    _connection: string;
    /**
     Type of compression to use
    */
    compression: 'none' | 'gzip' | 'snappy' | 'lz4' | 'inherit';
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
    /**
     * This field indicates the number of acknowledgements the leader broker
     * must receive from ISR brokers before responding to the request:
     * 0=Broker does not send any response/ack to client,
     * -1 or all=Broker will block until message is committed by all in sync replicas (ISRs).
     * If there are less than min.insync.replicas (broker configuration) in the ISR set the
     * produce request will fail.
    */
    required_acks: number;
    /**
     * Name of kafka api used for sender, if none is provided, then one is made
     * and the name is kafka_sender_api, and is injected into the execution
    */
    _api_name: string;
}
