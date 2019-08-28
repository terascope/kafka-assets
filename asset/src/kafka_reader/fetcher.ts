import {
    Fetcher,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    DataEntity
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { KafkaReaderConfig } from './interfaces';
import { ConsumerClient } from '../_kafka_clients';
import {
    KafkaMessage,
    KafkaMessageMetadata
} from '../_kafka_helpers';

export default class KafkaFetcher extends Fetcher<KafkaReaderConfig> {
    consumer: ConsumerClient;

    constructor(context: WorkerContext, opConfig: KafkaReaderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-consumer' });

        this.consumer = new ConsumerClient(this.createClient(), {
            logger,
            topic: this.opConfig.topic,
        });
    }

    async initialize() {
        await super.initialize();
        await this.consumer.connect();
    }

    async shutdown() {
        this.consumer.handlePendingCommits();
        await this.consumer.disconnect();
        await super.shutdown();
    }

    async fetch() {
        const map = this.tryRecord((msg: KafkaMessage): DataEntity => {
            const now = Date.now();

            const metadata: KafkaMessageMetadata = {
                _key: keyToString(msg.key),
                _ingestTime: msg.timestamp,
                _processTime: now,
                // TODO this should be based of an actual value
                _eventTime: now,
                topic: msg.topic,
                partition: msg.partition,
                offset: msg.offset,
                size: msg.size,
            };

            return DataEntity.fromBuffer(
                msg.value,
                this.opConfig,
                metadata
            );
        });

        return this.consumer.consume(map, this.opConfig);
    }

    async onSliceFinalizing() {
        await this.consumer.commit(this.opConfig.use_commit_sync);
    }

    // TODO we should handle slice retries differently now that we have the dead letter queue
    async onSliceRetry() {
        if (this.opConfig.rollback_on_failure) {
            await this.consumer.rollback();
        } else {
            this.logger.warn('committing kafka offsets on slice retry - THIS MAY CAUSE DATA LOSS');
            await this.consumer.commit(this.opConfig.use_commit_sync);
        }
    }

    private clientConfig() {
        const config = {
            type: 'kafka',
            endpoint: this.opConfig.connection,
            options: {
                type: 'consumer',
                group: this.opConfig.group
            },
            topic_options: {
                'auto.offset.reset': this.opConfig.offset_reset
            },
            rdkafka_options: {
                // Explicitly manage offset commits.
                'enable.auto.commit': false,
                'enable.auto.offset.store': false,
                'queued.min.messages': 2 * this.opConfig.size,
                // Capture the rebalances for better error handling and debug
                rebalance_cb: true,
                // Capture the commits for better error handling and debug
                offset_commit_cb: true,
                // Set the max.poll.interval.ms
                'max.poll.interval.ms': this.opConfig.max_poll_interval,
            },
            autoconnect: false
        };

        const assignmentStrategy = this.opConfig.partition_assignment_strategy;
        if (assignmentStrategy) {
            config.rdkafka_options['partition.assignment.strategy'] = assignmentStrategy;
        }

        return config as ConnectionConfig;
    }

    private createClient(): kafka.KafkaConsumer {
        const connection = this.context.foundation.getConnection(this.clientConfig());
        return connection.client;
    }
}

/** Safely convert a buffer or string to a string */
function keyToString(str?: string|Buffer) {
    if (!str) return null;
    return str.toString('utf8');
}
