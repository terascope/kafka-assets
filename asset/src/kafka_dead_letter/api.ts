import {
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    OperationAPI,
    DeadLetterAPIFn,
    parseError,
    Collector,
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { KafkaDeadLetterConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';

export default class KafkaDeadLetter extends OperationAPI<KafkaDeadLetterConfig> {
    producer: ProducerClient;
    collector: Collector<ProduceMessage>;

    constructor(
        context: WorkerContext,
        apiConfig: KafkaDeadLetterConfig,
        executionConfig: ExecutionConfig
    ) {
        super(context, apiConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });

        this.producer = new ProducerClient(this.createClient(), {
            logger,
            topic: this.apiConfig.topic,
            bufferSize: this.apiConfig.max_buffer_size,
        });

        this.collector = new Collector({
            size: this.apiConfig.size,
            wait: this.apiConfig.wait,
        });
    }

    async initialize(): Promise<void> {
        await super.initialize();
        await this.producer.connect();
    }

    async shutdown(): Promise<void> {
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
                } catch (_err) {
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
                topic: null
            };

            this.collector.add(msg);
        };
    }

    async onSliceFinalizing(): Promise<void> {
        const batch = this.collector.flushAll();
        await this.producer.produce(batch);
    }

    private clientConfig() {
        const config = {
            type: 'kafka',
            endpoint: this.apiConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': this.apiConfig.compression,
                'queue.buffering.max.messages': this.apiConfig.max_buffer_size,
                'queue.buffering.max.ms': this.apiConfig.wait,
                'batch.num.messages': this.apiConfig.size,
                'topic.metadata.refresh.interval.ms': this.apiConfig.metadata_refresh,
                'log.connection.close': false
            },
            autoconnect: false
        };

        const assignmentStrategy = this.apiConfig.partition_assignment_strategy;
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
