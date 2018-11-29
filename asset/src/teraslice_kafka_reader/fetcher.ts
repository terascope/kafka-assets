import { KafkaReaderConfig } from './interfaces';
import {
    Fetcher,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig
} from '@terascope/job-components';
import ConsumerClient from './consumer-client';
import { KafkaConsumer } from 'node-rdkafka';

export default class KafkaReader extends Fetcher<KafkaReaderConfig> {
    private consumer: ConsumerClient;

    constructor(context: WorkerContext, opConfig: KafkaReaderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        this.consumer = new ConsumerClient(this.createClient(), this.logger, this.opConfig);
    }

    async initialize() {
        await super.initialize();
        await this.consumer.connect();
        this.logger.info('Connected to Kafka');
    }

    async shutdown() {
        await this.consumer.disconnect();
        await super.shutdown();
    }

    async fetch() {
        const result = await this.consumer.consume();
        return result;
    }

    private clientConfig() {
        return {
            type: 'kafka',
            endpoint: this.opConfig.connection,
            options: {
                type: 'consumer',
                group: this.opConfig.group
            },
            topic_options: {
                'auto.offset.reset': this.opConfig.offset_reset
            },
            rdkafka_options: {
                // We want to explicitly manage offset commits.
                'enable.auto.commit': false,
                'enable.auto.offset.store': false,
                'queued.min.messages': 2 * this.opConfig.size
            },
            autoconnect: false
        } as ConnectionConfig;
    }

    private createClient(): KafkaConsumer {
        const connection = this.context.foundation.getConnection(this.clientConfig());
        return connection.client;
    }
}
