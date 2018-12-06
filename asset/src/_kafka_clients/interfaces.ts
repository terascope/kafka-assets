import { Logger } from '@terascope/job-components';
import { BadRecordAction } from '../kafka_reader/interfaces';

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
    bad_record_action: BadRecordAction;
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
    bufferSize: number;
}

export { BadRecordAction };
