import { Fetcher, DataEntity, APIFactoryRegistry } from '@terascope/job-components';
import { KafkaReaderAPIConfig } from '../kafka_reader_api/interfaces';
import { KafkaReaderConfig } from './interfaces';
import { APIConsumer } from '../_kafka_clients';

type KafkaReaderFactoryAPI = APIFactoryRegistry<APIConsumer, KafkaReaderAPIConfig>

const DEFAULT_API_NAME = 'kafka_reader_api';
export default class KafkaFetcher extends Fetcher<KafkaReaderConfig> {
    consumer!: APIConsumer;
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

        const api = this.getAPI<KafkaReaderFactoryAPI>(apiName);
        // this might be undefined, but will throw in the create call if it does not exist
        const topic = this.opConfig.topic || apiTopic as string;
        const consumer = await api.create(topic, {});
        // we do this as size and wait might live on the apiConfig, not on the processors opConfig
        const { size, wait } = api.getConfig(topic) as KafkaReaderAPIConfig;

        this.consumeConfig = { size, wait };
        this.consumer = consumer;
    }

    async fetch(): Promise<DataEntity[]> {
        return this.consumer.consume(this.consumeConfig);
    }
}
