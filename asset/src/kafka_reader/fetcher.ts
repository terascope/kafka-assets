import { Fetcher, isPromAvailable, makeExContextLogger } from '@terascope/job-components';
import { DataEntity, Logger } from '@terascope/core-utils';
import { KafkaReaderAPIConfig, KafkaReaderAPI, DEFAULT_API_NAME } from '../kafka_reader_api/interfaces.js';
import { KafkaReaderConfig } from './interfaces.js';
import { APIConsumer } from '../_kafka_clients/index.js';

export default class KafkaFetcher extends Fetcher<KafkaReaderConfig> {
    consumer!: APIConsumer;
    consumeConfig!: { size: number; wait: number };

    async initialize(): Promise<void> {
        await super.initialize();

        // TODO: This should be in the context but doesn't seem to work at the moment
        const kafkaLogger: Logger = makeExContextLogger(this.context, this.executionConfig, 'kafka-consumer');

        let apiName = DEFAULT_API_NAME;
        let apiTopic: string | undefined;

        if (this.opConfig.api_name) {
            apiName = this.opConfig?.api_name;
            const apiConfig = this.executionConfig.apis.find((config) => config._name === apiName);
            if (apiConfig == null) throw new Error(`could not find api configuration for api ${apiName}`);
            apiTopic = apiConfig.topic;
        }

        const api = this.getAPI<KafkaReaderAPI>(apiName);
        // this might be undefined, but will throw in the create call if it does not exist
        const topic = this.opConfig.topic || apiTopic as string;
        const consumer = await api.create(topic, { logger: kafkaLogger });
        // we do this as size and wait might live on the apiConfig, not on the processors opConfig
        const { size, wait } = api.getConfig(topic) as KafkaReaderAPIConfig;

        this.consumeConfig = { size, wait };
        this.consumer = consumer;

        const { context, opConfig } = this;
        if (isPromAvailable(context)) {
            await this.context.apis.foundation.promMetrics.addGauge(
                'kafka_partitions',
                'Number of partitions the kafka consumer is consuming from',
                ['op_name'],
                async function collect() {
                    const partitionCount = await consumer.getPartitionCount(topic);
                    const labels = {
                        op_name: opConfig._op,
                        ...context.apis.foundation.promMetrics.getDefaultLabels()
                    };
                    this.set(labels, partitionCount);
                });
            await this.context.apis.foundation.promMetrics.addGauge(
                'kafka_bytes_consumed',
                'Number of bytes the kafka consumer has consumed',
                ['op_name'],
                async function collect() {
                    const bytesConsumed = await consumer.getBytesConsumed();
                    const labels = {
                        op_name: opConfig._op,
                        ...context.apis.foundation.promMetrics.getDefaultLabels()
                    };
                    this.set(labels, bytesConsumed);
                });
        }
    }

    async fetch(): Promise<DataEntity[]> {
        return this.consumer.consume(this.consumeConfig);
    }
}
