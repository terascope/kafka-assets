import { Logger, DataEncoding } from '@terascope/job-components';

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
    encoding: { _encoding?: DataEncoding, _op?: string };
    bad_record_action: 'none'|'throw'|'log';
    logger: Logger;
}

export interface ProduceMessage {
    topic: string;
    data: Buffer;
    key: string|null;
    timestamp: number;
}

export interface ProducerClientConfig {
    topic: string;
    encoding: { _encoding?: DataEncoding, _op?: string };
    logger: Logger;
}
