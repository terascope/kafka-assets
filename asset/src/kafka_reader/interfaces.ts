import { OpConfig } from '@terascope/job-components';

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
     How many records to read before a slice is considered complete
    */
    size: number;

    /**
     How often to attempt to consume `size` number of records. This only comes into play if the initial consume could not get a full slice.
    */
    interval: number;

    /**
     Controls whether the consumer state is rolled back on failure.
     This will protect against data loss, however this can have an unintended side effect
     of blocking the job from moving if failures are minor and persistent.
     NOTE: This currently defaults to `false` due to the side effects of the behavior,
     at some point in the future it is expected this will default to `true`.
    */
    rollback_on_failure: boolean;
}
