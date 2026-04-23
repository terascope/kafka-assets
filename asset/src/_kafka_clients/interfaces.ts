import { Logger, DataEncoding, DataEntity, DataEntityMetadata } from '@terascope/core-utils';
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
    opaque: DeliveryReportOpaque | null;
}

export interface ProducerClientConfig {
    topic: string;
    logger: Logger;
    maxBufferLength: number;
    maxBufferKilobyteSize: number;
    deliveryReportConfig?: DeliveryReportConfig;
    queue_backpressure_strategy?: 'threshold_flush' | 'retry_on_full';
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

export interface DeliveryReportOpaque {
    batchNumber: number;
    msgNumber: number;
    sourceMetadata: DataEntityMetadata & Record<string, unknown>;
}

export interface DeliveryReportStats {
    [batchNumber: number]: DeliveryReportBatchStats;
}

export interface DeliveryReportBatchStats {
    received: number;
    errors: number;
    expected: number;
}

export type DeliveryReportConfig = {
    /**
     * Wait for all delivery reports before continuing to next batch of messages.
     * Requires `waitTimeout` to be set.
     */
    wait: boolean;
    /**
     * Timeout in milliseconds to wait for all delivery reports before rejecting.
     */
    waitTimeout: number | undefined;
    /**
     * Only receive delivery reports for failed messages. Must be false when `wait` is true.
     * This setting overrides the `delivery.report.only.error` field in `rdkafka_options`.
     */
    only_error: boolean;
    /**
     * Action to take when a delivery report indicates an error with a message.
     * If the `throw` option is chosen `wait` must be true.
     */
    on_error: 'log' | 'throw' | 'ignore';
} | undefined;
