import { Logger, DataEncoding, DataEntity } from '@terascope/job-components';
import { KafkaMessage } from '../_kafka_helpers/index.js';

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
    // This is added because the new confluent client returns this.
    leaderEpoch?: number;
}

export interface ConsumerClientConfig {
    topic: string;
    logger: Logger;
    _encoding?: DataEncoding;
    rollback_on_failure?: boolean;
    use_commit_sync?: boolean;
    tryFn?: (input: any) => any;
}

export interface ProduceMessage {
    topic: string | null;
    data: Buffer;
    key: Buffer | string | null;
    timestamp: number | null;
}

export interface ProducerClientConfig {
    topic: string;
    logger: Logger;
    maxBufferLength: number;
    maxBufferKilobyteSize: number;
}

export interface FatalError extends Error {
    fatalError: true;
}

export type ConsumeFn = (
    fn: (msg: KafkaMessage) => DataEntity
) => (msg: KafkaMessage) => DataEntity;

export type ProduceFn = (
    fn: (msg: KafkaMessage) => DataEntity
) => (msg: KafkaMessage) => void;
