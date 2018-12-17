import {
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    OperationAPI,
    DeadLetterAPIFn,
    parseError,
} from '@terascope/job-components';
import { KafkaDeadLetterConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';
import * as kafka from 'node-rdkafka';

export default class KafkaDeadLetter extends OperationAPI<KafkaDeadLetterConfig> {
    producer: ProducerClient;
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
    }

    async initialize() {
        await super.initialize();
        await this.producer.connect();
    }

    async shutdown() {
        await this.producer.disconnect();
        await super.shutdown();
    }

    async createAPI(): Promise<DeadLetterAPIFn> {
        return (input: any, err: Error) => {
            this.producer.produce([input], (msg: any): ProduceMessage => {
                let record: string;

                if (msg && Buffer.isBuffer(msg)) {
                    record = msg.toString('utf8');
                } else {
                    try {
                        record = JSON.stringify(msg);
                    } catch (err) {
                        record = msg;
                    }
                }

                const data = {
                    record,
                    error: parseError(err, true)
                };

                return {
                    timestamp: Date.now(),
                    data: Buffer.from(JSON.stringify(data)),
                    key: null,
                };
            });
        };
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
