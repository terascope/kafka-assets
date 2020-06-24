import { Logger, DataEncoding, DataEntity } from '@terascope/job-components';
import { KafkaMessage } from '../_kafka_helpers';

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
    _encoding?: DataEncoding,
    rollback_on_failure?: boolean;
    use_commit_sync?: boolean;
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

export type ConsumeFn = (
    fn: (msg: KafkaMessage) => DataEntity
) => (msg: KafkaMessage) => DataEntity

export type ProduceFn = (
    fn: (msg: KafkaMessage) => DataEntity
) => (msg: KafkaMessage) => void
