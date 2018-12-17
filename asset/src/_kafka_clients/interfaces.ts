import { Logger } from '@terascope/job-components';

export interface OffsetByPartition {
    [partition: number]: number;
}

export interface TrackedOffsets {
    started: OffsetByPartition;
    ended: OffsetByPartition;
}

export interface TopicPartition {
    partition: number;
    offset: number;
    topic: string;
}

export interface ConsumerClientConfig {
    topic: string;
    logger: Logger;
}

export interface ProduceMessage {
    data: Buffer;
    key: string|null;
    timestamp: number|null;
}

export interface ProducerClientConfig {
    topic: string;
    logger: Logger;
    batchSize: number;
}
