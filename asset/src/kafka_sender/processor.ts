import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    getValidDate,
    isString,
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { KafkaSenderConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    producer: ProducerClient;
    private _bufferSize: number;

    constructor(
        context: WorkerContext,
        opConfig: KafkaSenderConfig,
        executionConfig: ExecutionConfig
    ) {
        super(context, opConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });

        this._bufferSize = this.opConfig.size * 5;

        this.producer = new ProducerClient(this.createClient(), {
            logger,
            topic: this.opConfig.topic,
            bufferSize: this._bufferSize,
        });
    }

    async initialize() {
        await super.initialize();
        await this.producer.connect();
    }

    async shutdown() {
        await this.producer.disconnect();
        await super.shutdown();
    }

    async onBatch(batch: DataEntity[]) {
        await this.producer.produce(batch, this.mapFn());
        return batch;
    }

    private getKey(msg: DataEntity): string|null {
        if (this.opConfig.id_field) {
            const key = msg[this.opConfig.id_field];

            if (key == null) return null;

            if (!key || !isString(key)) {
                const err = new Error(`invalid id_field on record ${this.opConfig.id_field}`);
                this.rejectRecord(msg, err);
                return null;
            }

            return key;
        }

        return DataEntity.getMetadata(msg, '_key') || null;
    }

    private getTimestamp(msg: DataEntity): number|null {
        if (this.opConfig.timestamp_field) {
            const date = getValidDate(msg[this.opConfig.timestamp_field]);
            if (date) return date.getTime();

            const err = new Error(`invalid timestamp_field on record ${this.opConfig.timestamp_field}`);
            this.rejectRecord(msg, err);
        } else if (this.opConfig.timestamp_now) {
            return Date.now();
        }

        return null;
    }

    private mapFn() {
        return (msg: DataEntity): ProduceMessage => {
            const key = this.getKey(msg);
            const timestamp = this.getTimestamp(msg);
            const data = msg.toBuffer();

            return { timestamp, key, data };
        };
    }

    private clientConfig() {
        const config = {
            type: 'kafka',
            endpoint: this.opConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': this.opConfig.compression,
                'queue.buffering.max.messages': this._bufferSize,
                'queue.buffering.max.ms': this.opConfig.wait,
                'batch.num.messages': this.opConfig.size,
                'topic.metadata.refresh.interval.ms': this.opConfig.metadata_refresh,
                'log.connection.close': false,
            },
            autoconnect: false
        };

        const assignmentStrategy = this.opConfig.partition_assignment_strategy;
        if (assignmentStrategy) {
            config.rdkafka_options['partition.assignment.strategy'] = assignmentStrategy;
        }

        return config as ConnectionConfig;
    }

    private createClient(): kafka.Producer {
        const config = this.clientConfig();
        const connection = this.context.foundation.getConnection(config);
        return connection.client;
    }
}
