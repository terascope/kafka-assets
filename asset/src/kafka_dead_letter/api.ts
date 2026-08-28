import {
    ConnectionConfig,
    OperationAPI
} from '@terascope/job-components';
import kafka, { IAdminClient } from '@confluentinc/kafka-javascript';
import { parseError, Collector, DataEntity } from '@terascope/core-utils';
import { DeadLetterAPIFn } from '@terascope/types';
import { KafkaDeadLetterConfig } from './interfaces.js';
import { ProducerClient, ProduceMessage } from '../_kafka_clients/index.js';

/**
 * Builds a `JSON.stringify` replacer that makes any value serializable.
 * `JSON.stringify` throws on `BigInt` values and on circular references, so we
 * convert `BigInt` to a string and replace circular references with a marker.
 * A fresh `WeakSet` is created per call so references from a previous record
 * aren't falsely flagged as circular.
 */
function makeSafeReplacer() {
    const seen = new WeakSet<object>();
    return (_key: string, value: unknown) => {
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    };
}

export default class KafkaDeadLetter extends OperationAPI<KafkaDeadLetterConfig> {
    producer!: ProducerClient;
    collector!: Collector<ProduceMessage>;
    admin!: IAdminClient;
    private batchNumber = 1;
    private msgNumber = 1;

    async initialize(): Promise<void> {
        await super.initialize();
        const logger = this.context.apis.foundation.makeLogger({ module: 'kafka-dead-letter' });

        this.admin = await this.createAdminClient();
        const client = await this.createClient();

        this.producer = new ProducerClient(client, this.admin, {
            logger,
            topic: this.apiConfig.topic,
            maxBufferLength: this.apiConfig.max_buffer_size,
            maxBufferKilobyteSize: this.apiConfig.max_buffer_kbytes_size,
            deliveryReportConfig: this.apiConfig.delivery_report
        });

        this.collector = new Collector({
            size: this.apiConfig.size,
            wait: this.apiConfig.wait,
        });

        await this.producer.connect();
    }

    async shutdown(): Promise<void> {
        const batch = this.collector.flushAll();
        await this.producer.produce(batch, this.batchNumber);
        this.batchNumber++;
        this.msgNumber = 1;

        await this.producer.disconnect();
        this.admin.disconnect();
        await super.shutdown();
    }

    async createAPI(): Promise<DeadLetterAPIFn> {
        return (input: any, err: Error) => {
            let record: string;
            let sourceMetadata = {};

            if (DataEntity.isDataEntity(input)) {
                sourceMetadata = input.getMetadata();
            }

            if (input && Buffer.isBuffer(input)) {
                record = input.toString('utf8');
            } else {
                // The replacer handles the only two cases where stringify throws:
                // BigInt values and circular references.
                record = JSON.stringify(input, makeSafeReplacer());
            }

            const data = {
                record,
                error: parseError(err, true)
            };

            const msg: ProduceMessage = {
                timestamp: Date.now(),
                data: Buffer.from(JSON.stringify(data, makeSafeReplacer())),
                key: null,
                topic: null,
                opaque: {
                    batchNumber: this.batchNumber,
                    msgNumber: this.msgNumber++,
                    sourceMetadata
                }
            };

            this.collector.add(msg);
        };
    }

    async onSliceFinalizing(): Promise<void> {
        const batch = this.collector.flushAll();
        await this.producer.produce(batch, this.batchNumber);
        this.batchNumber++;
        this.msgNumber = 1;
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
                'log.connection.close': false,
                ...this.apiConfig.rdkafka_options
            } as Record<string, any>,
            autoconnect: false
        } as ConnectionConfig;
    }

    private async createClient(): Promise<kafka.Producer> {
        const config = this.clientConfig();
        const connection = await this.context.apis.foundation.createClient(config);
        return connection.client;
    }

    private async createAdminClient(): Promise<IAdminClient> {
        const config = {
            type: 'kafka',
            endpoint: this.apiConfig._connection,
            options: {
                type: 'admin'
            },
            rdkafka_options: {
                'topic.metadata.refresh.interval.ms': this.apiConfig.metadata_refresh,
                'log.connection.close': false
            }
        };
        const connection = await this.context.apis.foundation.createClient(config);
        return connection.client;
    }
}
