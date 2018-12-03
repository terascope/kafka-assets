import omit from 'lodash.omit';
import { KafkaReaderConfig } from './interfaces';
import {
    Fetcher,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    DataEntity
} from '@terascope/job-components';
import { ConsumerClient } from '../_kafka_clients';
import * as kafka from 'node-rdkafka';
import {
    KafkaMessage,
    KafkaMessageMetadata
} from '../_kafka_helpers';

export default class KafkaFetcher extends Fetcher<KafkaReaderConfig> {
    consumer: ConsumerClient;

    constructor(context: WorkerContext, opConfig: KafkaReaderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        const logger = context.apis.foundation.makeLogger({
            module: 'kafka-consumer',
            opName: opConfig._op,
            jobName: executionConfig.name,
            jobId: executionConfig.job_id,
            exId: executionConfig.ex_id,
        });

        this.consumer = new ConsumerClient(this.createClient(), {
            logger,
            topic: this.opConfig.topic,
            bad_record_action: this.opConfig.bad_record_action
        });
    }

    async initialize() {
        await super.initialize();
        await this.consumer.connect();
    }

    async shutdown() {
        await this.consumer.disconnect();
        await super.shutdown();
    }

    async fetch() {
        const map = (msg: KafkaMessage): DataEntity => {
            const metadata: KafkaMessageMetadata = omit(msg, 'value');
            return DataEntity.fromBuffer(
                msg.value,
                this.opConfig,
                metadata
            );
        };

        const result = await this.consumer.consume(map, this.opConfig);
        return result;
    }

    async onSliceFinalizing() {
        await this.consumer.commit();
    }

    async onSliceRetry() {
        if (this.opConfig.rollback_on_failure) {
            await this.consumer.rollback();
        } else {
            this.logger.warn('committing kafka offsets on slice retry - THIS MAY CAUSE DATA LOSS');
            await this.consumer.commit();
        }
    }

    private clientConfig() {
        return {
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
                // We want to explicitly manage offset commits.
                'enable.auto.commit': false,
                'enable.auto.offset.store': false,
                'queued.min.messages': 2 * this.opConfig.size,
                // we want to capture the rebalance so we can handle
                // them better
                rebalance_cb: true,
            },
            autoconnect: false
        } as ConnectionConfig;
    }

    private createClient(): kafka.KafkaConsumer {
        const connection = this.context.foundation.getConnection(this.clientConfig());
        return connection.client;
    }
}
