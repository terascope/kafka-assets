import {
    ConnectionConfig,
    OperationAPI
} from '@terascope/job-components';
import { parseError, Collector } from '@terascope/core-utils';
import { DeadLetterAPIFn } from '@terascope/types';
import { KafkaDeadLetterConfig } from './interfaces.js';
import { ProducerClient, ProduceMessage, KafkaProducerClients } from '../_kafka_clients/index.js';

export default class KafkaDeadLetter extends OperationAPI<KafkaDeadLetterConfig> {
    producer!: ProducerClient;
    collector!: Collector<ProduceMessage>;

    async initialize(): Promise<void> {
        await super.initialize();
        const logger = this.logger.child({ module: 'kafka-producer' });

        const { producerClient, adminClient } = await this.createClient();

        this.producer = new ProducerClient(producerClient, {
            logger,
            topic: this.apiConfig.topic,
            maxBufferLength: this.apiConfig.max_buffer_size,
            maxBufferKilobyteSize: this.apiConfig.max_buffer_kbytes_size
        }, adminClient);

        this.collector = new Collector({
            size: this.apiConfig.size,
            wait: this.apiConfig.wait,
        });

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
        return {
            type: 'kafka',
            endpoint: this.apiConfig._connection,
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
            } as Record<string, any>,
            autoconnect: false
        } as ConnectionConfig;
    }

    private async createClient(): Promise<KafkaProducerClients> {
        const config = this.clientConfig();
        const connection = await this.context.apis.foundation.createClient(config);
        return connection.client;
    }
}
