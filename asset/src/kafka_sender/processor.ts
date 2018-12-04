import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    getValidDate,
    isString,
    Collector,
} from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';
import * as kafka from 'node-rdkafka';

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    producer: ProducerClient;
    collector: Collector<DataEntity>;
    private bufferSize: number;

    constructor(context: WorkerContext, opConfig: KafkaSenderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });

        this.bufferSize = this.opConfig.size * 5;

        this.producer = new ProducerClient(this.createClient(), {
            logger,
            topic: this.opConfig.topic
        });

        this.collector = new Collector(opConfig);
    }

    async initialize() {
        await super.initialize();
        await this.producer.connect();
    }

    async shutdown() {
        const records = this.collector.flushAll();
        if (records.length > 0) {
            this.logger.warn(`shutting down but ${records.length} records are still in memory, flushing...`);
            await this.producer.produce(records, this.mapFn());
        }
        await this.producer.disconnect();
        await super.shutdown();
    }

    async onBatch(batch: DataEntity[]) {
        this.collector.add(batch);
        const records = this.collector.getBatch();
        if (records == null) return [];

        await this.producer.produce(records, this.mapFn());
        return records;
    }

    private getKey(msg: DataEntity): string|null {
        if (!this.opConfig.id_field) return null;

        const key = msg[this.opConfig.id_field];
        if (key && isString(key)) return key;

        // TODO we should probably do something like bad_record_action
        this.logger.error(`invalid id_field on record ${this.opConfig.id_field}`);
        return null;
    }

    private getTimestamp(msg: DataEntity): number|null {
        if (this.opConfig.timestamp_field) {
            const date = getValidDate(msg[this.opConfig.timestamp_field]);
            if (date) return date.getTime();

            // TODO we should probably do something like bad_record_action
            this.logger.error(`invalid timestamp_field on record ${this.opConfig.timestamp_field}`);
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
        return {
            type: 'kafka',
            endpoint: this.opConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': this.opConfig.compression,
                'queue.buffering.max.messages': this.bufferSize,
                'queue.buffering.max.ms': this.opConfig.wait,
                'batch.num.messages': this.opConfig.size,
                'topic.metadata.refresh.interval.ms': this.opConfig.metadata_refresh,
                'log.connection.close': false
            },
            autoconnect: false
        } as ConnectionConfig;
    }

    private createClient(): kafka.Producer {
        const connection = this.context.foundation.getConnection(this.clientConfig());
        return connection.client;
    }
}
