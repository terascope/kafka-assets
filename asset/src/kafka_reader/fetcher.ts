import { Fetcher, DataEntity } from '@terascope/job-components';
import KafkaApi from '../kafka_reader_api/api';
import { KafkaReaderConfig } from './interfaces';
import { ConsumerClient, ConsumeFn } from '../_kafka_clients';

const DEFAULT_API_NAME = 'kafka_reader_api';
export default class KafkaFetcher extends Fetcher<KafkaReaderConfig> {
    consumer!: ConsumerClient;

    async initialize(): Promise<void> {
        await super.initialize();
        const api = this.getAPI<KafkaApi>(this.opConfig.api_name || DEFAULT_API_NAME);
        const consumer = await api.create(this.opConfig.topic, this.opConfig);
        this.consumer = consumer;
    }

    async shutdown(): Promise<void> {
        this.consumer.handlePendingCommits();
        await this.consumer.disconnect();
        await super.shutdown();
    }

    async fetch(): Promise<DataEntity[]> {
        const tryRecord = this.tryRecord.bind(this) as ConsumeFn;
        return this.consumer.consume(tryRecord, this.opConfig);
    }
}
