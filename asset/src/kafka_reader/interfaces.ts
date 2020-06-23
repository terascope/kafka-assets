import { OpConfig, DataEncoding } from '@terascope/job-components';

export interface KafkaReaderConfig extends OpConfig {
    /**
     Name of the Kafka topic to process
    */
    topic: string;

    /**
     Name of the Kafka consumer group
    */
    group: string;

    /**
     How offset resets should be handled when there are no valid offsets for the consumer group.
    */
    offset_reset: 'smallest'|'earliest'|'beginning'|'largest'|'latest'|'error';

    /**
     The Kafka consumer connection to use.
    */
    connection: string;

    /**
     How long to wait for a full chunk of data to be available. Specified in milliseconds
    */
    wait: number;

    /**
    * The maximum delay between invocations of poll() when using consumer group management.
    * This places an upper bound on the amount of time that the consumer can be idle
    * before fetching more records.
    * If poll() is not called before expiration of this timeout,
    * then the consumer is considered failed
    * and the group will rebalance in order to reassign the partitions to another member.
    */
    max_poll_interval: number;

    /**
     How many records to read before a slice is considered complete
    */
    size: number;

    /**
     * Use commit sync instead of async (usually not recommended)
    */
    use_commit_sync: boolean;

    /**
     Controls whether the consumer state is rolled back on failure.
     This will protect against data loss, however this can have an unintended side effect
     of blocking the job from moving if failures are minor and persistent.
     NOTE: This currently defaults to `false` due to the side effects of the behavior,
     at some point in the future it is expected this will default to `true`.
    */
    rollback_on_failure: boolean;

    /**
     * Name of partition assignment strategy to use when elected group leader
     * assigns partitions to group members.
    */
    partition_assignment_strategy?: 'range'|'roundrobin';
    /**
     * Name of kafka api used for reader, if none is provided, then one is made
     * and the name is kafka_reader_api, and is injected into the execution
    */
    api_name?: string;
    /**
     * How to decode data from buffer, defaults to JSON
     *
    */
    _encoding?: DataEncoding
}
