import { Fetcher, DataEntity, APIFactoryRegistry } from '@terascope/job-components';
import { KafkaAPIConfig } from '../kafka_reader_api/interfaces';
import { KafkaReaderConfig } from './interfaces';
import { ConsumerClient, ConsumeFn } from '../_kafka_clients';

type KafkaFactoryAPI = APIFactoryRegistry<ConsumerClient, KafkaAPIConfig>

const DEFAULT_API_NAME = 'kafka_reader_api';
export default class KafkaFetcher extends Fetcher<KafkaReaderConfig> {
    consumer!: ConsumerClient;
    consumeConfig!: { size: number; wait: number };

    async initialize(): Promise<void> {
        await super.initialize();
        let apiName = DEFAULT_API_NAME;
        let apiTopic: string | undefined;

        if (this.opConfig.api_name) {
            apiName = this.opConfig?.api_name;
            const apiConfig = this.executionConfig.apis.find((config) => config._name === apiName);
            if (apiConfig == null) throw new Error(`could not find api configuration for api ${apiName}`);
            apiTopic = apiConfig.topic;
        }

        const api = this.getAPI<KafkaFactoryAPI>(apiName);
        // this might be undefined, but will throw in the create call if it does not exist
        const topic = this.opConfig.topic || apiTopic as string;
        const consumer = await api.create(topic, this.opConfig);
        // we do this as size and wait might live on the apiConfig, not on the processors opConfig
        const { size, wait } = api.getConfig(topic) as KafkaAPIConfig;

        this.consumeConfig = { size, wait };
        this.consumer = consumer;
    }

    async fetch(): Promise<DataEntity[]> {
        const tryRecord = this.tryRecord.bind(this) as ConsumeFn;
        return this.consumer.consume(tryRecord, this.consumeConfig);
    }
}
