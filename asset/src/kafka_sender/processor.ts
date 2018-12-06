import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    getValidDate,
    isString,
} from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';
import * as kafka from 'node-rdkafka';

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    producer: ProducerClient;

    constructor(context: WorkerContext, opConfig: KafkaSenderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });

        const bufferSize = this.opConfig.size * 5;

        this.producer = new ProducerClient(this.createClient(bufferSize), {
            logger,
            topic: this.opConfig.topic,
            bufferSize,
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

    private clientConfig(bufferSize: number) {
        return {
            type: 'kafka',
            endpoint: this.opConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': this.opConfig.compression,
                'queue.buffering.max.messages': bufferSize,
                'queue.buffering.max.ms': this.opConfig.wait,
                'batch.num.messages': this.opConfig.size,
                'topic.metadata.refresh.interval.ms': this.opConfig.metadata_refresh,
                'log.connection.close': false
            },
            autoconnect: false
        } as ConnectionConfig;
    }

    private createClient(bufferSize: number): kafka.Producer {
        const config = this.clientConfig(bufferSize);
        const connection = this.context.foundation.getConnection(config);
        return connection.client;
    }
}
