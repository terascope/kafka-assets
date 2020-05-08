import { Logger } from '@terascope/job-components';

export interface OffsetByPartition {
    [partition: number]: number;
}

export interface CountPerPartition {
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
    topic: string|null;
    data: Buffer;
    key: Buffer|string|null;
    timestamp: number|null;
}

export interface ProducerClientConfig {
    topic: string;
    logger: Logger;
    bufferSize: number;
}

export interface FatalError extends Error {
    fatalError: true;
}
