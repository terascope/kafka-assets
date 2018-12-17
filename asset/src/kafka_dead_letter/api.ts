import {
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    OperationAPI,
    DeadLetterAPIFn,
    parseError,
    Collector,
} from '@terascope/job-components';
import { KafkaDeadLetterConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';
import * as kafka from 'node-rdkafka';

export default class KafkaDeadLetter extends OperationAPI<KafkaDeadLetterConfig> {
    producer: ProducerClient;
    collector: Collector<ProduceMessage>;
    private _bufferSize: number;

    constructor(context: WorkerContext, apiConfig: KafkaDeadLetterConfig, executionConfig: ExecutionConfig) {
        super(context, apiConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });

        this._bufferSize = this.apiConfig.size * 5;

        this.producer = new ProducerClient(this.createClient(), {
            logger,
            topic: this.apiConfig.topic,
            batchSize: this._bufferSize,
        });

        this.collector = new Collector({
            size: this.apiConfig.size,
            wait: this.apiConfig.wait,
        });
    }

    async initialize() {
        await super.initialize();
        await this.producer.connect();
    }

    async shutdown() {
        const batch = this.collector.flushAll();
        await this.producer.produce(batch);

        await this.producer.disconnect();
        await super.shutdown();
    }

    async createAPI(): Promise<DeadLetterAPIFn> {
        return (input: any, err: Error) => {
            let record: string;

            if (input && Buffer.isBuffer(input)) {
                record = input.toString('utf8');
            } else {
                try {
                    record = JSON.stringify(input);
                } catch (err) {
                    record = input;
                }
            }

            const data = {
                record,
                error: parseError(err, true)
            };

            const msg = {
                timestamp: Date.now(),
                data: Buffer.from(JSON.stringify(data)),
                key: null,
            };

            this.collector.add(msg);
        };
    }

    async onSliceFinalizing() {
        const batch = this.collector.flushAll();
        await this.producer.produce(batch);
    }

    private clientConfig() {
        return {
            type: 'kafka',
            endpoint: this.apiConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': this.apiConfig.compression,
                'queue.buffering.max.messages': this._bufferSize,
                'queue.buffering.max.ms': this.apiConfig.wait,
                'batch.num.messages': this.apiConfig.size,
                'topic.metadata.refresh.interval.ms': this.apiConfig.metadata_refresh,
                'log.connection.close': false
            },
            autoconnect: false
        } as ConnectionConfig;
    }

    private createClient(): kafka.Producer {
        const config = this.clientConfig();
        const connection = this.context.foundation.getConnection(config);
        return connection.client;
    }
}
