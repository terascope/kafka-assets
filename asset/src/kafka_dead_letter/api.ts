import {
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    OperationAPI,
    DeadLetterAPIFn,
    toString,
    parseError,
    isFunction,
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
                let data: Buffer;

                if (msg && Buffer.isBuffer(msg)) {
                    data = msg;
                } else if (msg && isFunction(msg.toBuffer)) {
                    data = msg.toBuffer() as Buffer;
                } else if (msg) {
                    data = Buffer.from(toString(msg));
                } else {
                    data = Buffer.from(parseError(err, true));
                }

                return {
                    timestamp: Date.now(),
                    data,
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
