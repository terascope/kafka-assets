import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
} from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';
import ProducerClient from './producer-client';
import * as kafka from 'node-rdkafka';

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    private producer: ProducerClient;
    private bufferSize: number;

    constructor(context: WorkerContext, opConfig: KafkaSenderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        const logger = context.apis.foundation.makeLogger({
            module: 'kafka-producer',
            opName: opConfig._op,
            jobName: executionConfig.name,
            jobId: executionConfig.job_id,
            exId: executionConfig.ex_id,
        });

        this.bufferSize = opConfig.size * 5;

        this.producer = new ProducerClient(this.createClient(), {
            logger,
            topic: this.opConfig.topic,
            encoding: {
                _op: this.opConfig._op,
                _encoding: this.opConfig._encoding,
            },
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

    async onBatch(data: DataEntity[]) {
        return data;
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
