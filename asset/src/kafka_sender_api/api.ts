import {
    APIFactory,
    AnyObject,
    ConnectionConfig,
    isNotNil,
    isNil,
    isString,
    getTypeOf,
    isNumber,
    isBoolean
} from '@terascope/job-components';
import { KafkaSenderConfig } from '../kafka_sender/interfaces';
import KafkaRouteSender from './sender';
import { KafkaSenderAPIConfig } from './interfaces';

export default class KafkaSenderApi extends APIFactory<KafkaRouteSender, KafkaSenderAPIConfig> {
    private validateConfig(config: AnyObject): KafkaSenderAPIConfig {
        if (isNil(config.topic) || !isString(config.topic)) throw new Error(`Parameter topic must be provided and be of type string, got ${getTypeOf(config.topic)}`);
        if (isNil(config.connection) || !isString(config.connection)) throw new Error(`Parameter connection must be provided and be of type string, got ${getTypeOf(config.connection)}`);
        if (isNil(config.size) || !isNumber(config.size)) throw new Error(`Parameter size must be provided and be of type number, got ${getTypeOf(config.size)}`);
        if (isNil(config.max_buffer_size) || !isNumber(config.max_buffer_size)) throw new Error(`Parameter max_buffer_size must be provided and be of type number, got ${getTypeOf(config.size)}`);
        if (isNotNil(config.id_field) && !isString(config.id_field)) throw new Error(`Parameter id_field must be provided and be of type string, got ${getTypeOf(config.id_field)}`);
        if (isNotNil(config.timestamp_field) && !isString(config.timestamp_field)) throw new Error(`Parameter timestamp_field must be provided and be of type string, got ${getTypeOf(config.timestamp_field)}`);
        if (isNotNil(config.timestamp_now) && !isBoolean(config.timestamp_now)) throw new Error(`Parameter timestamp_now must be provided and be of type string, got ${getTypeOf(config.timestamp_now)}`);
        if (isNil(config.partition_assignment_strategy) || !isString(config.partition_assignment_strategy)) throw new Error(`Parameter partition_assignment_strategy must be provided and be of type string, got ${getTypeOf(config.partition_assignment_strategy)}`);
        if (isNil(config.compression) || !isString(config.compression)) throw new Error(`Parameter compression must be provided and be of type string, got ${getTypeOf(config.compression)}`);
        if (isNil(config.wait) || !isNumber(config.wait)) throw new Error(`Parameter wait must be provided and be of type number, got ${getTypeOf(config.wait)}`);
        if (isNil(config.metadata_refresh) || !isNumber(config.metadata_refresh)) throw new Error(`Parameter metadata_refresh must be provided and be of type number, got ${getTypeOf(config.metadata_refresh)}`);
        if (isNil(config.required_acks) || !isNumber(config.required_acks)) throw new Error(`Parameter required_acks must be provided and be of type number, got ${getTypeOf(config.required_acks)}`);
        if (isNil(config.logger)) throw new Error(`Parameter logger must be provided and be of type Logger, got ${getTypeOf(config.logger)}`);

        // bufferSize is used as an indicator of when to flush the queue in producer-client.ts
        // in addition to the max.messages setting
        config.bufferSize = config.max_buffer_size;
        return config;
    }

    private clientConfig(clientConfig: KafkaSenderAPIConfig = {}) {
        const kafkaConfig = Object.assign({}, this.apiConfig, clientConfig);
        const config = {
            type: 'kafka',
            endpoint: kafkaConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': kafkaConfig.compression,
                'queue.buffering.max.messages': kafkaConfig.max_buffer_size,
                'queue.buffering.max.ms': kafkaConfig.wait,
                'batch.num.messages': kafkaConfig.size,
                'topic.metadata.refresh.interval.ms': kafkaConfig.metadata_refresh,
                'log.connection.close': false,
                // librdkafka >1.0.0 changed the default broker acknowledgement
                // to all brokers, but this has performance issues
                'request.required.acks': kafkaConfig.required_acks
            } as Record<string, any>,
            autoconnect: false
        };

        const assignmentStrategy = kafkaConfig.partition_assignment_strategy;
        if (assignmentStrategy) {
            config.rdkafka_options['partition.assignment.strategy'] = assignmentStrategy;
        }

        return config as ConnectionConfig;
    }

    async create(
        _connection: string, config: Partial<KafkaSenderConfig> = {}
    ): Promise<{ client: KafkaRouteSender, config: KafkaSenderAPIConfig }> {
        const logger = config.logger || this.logger;
        // if not set we treat as default
        if (isNil(config._key)) config._key = '*';

        const newConfig = Object.assign(
            {}, this.apiConfig, config, { logger }
        );

        const newTopic = (newConfig._key === '*' || newConfig._key === '**') ? newConfig.topic : `${newConfig.topic}-${config._key}`;
        newConfig.topic = newTopic;
        const validConfig = this.validateConfig(newConfig);
        const clientConfig = this.clientConfig(validConfig);

        const { client: kafkaClient } = await this.context.apis.foundation.createClient(
            clientConfig
        );

        validConfig.tryFn = this.tryRecord.bind(this);

        const client = new KafkaRouteSender(
            kafkaClient,
            validConfig,
            this.context.apis.foundation.promMetrics || undefined
        );

        await client.initialize();

        return { client, config: validConfig };
    }

    async shutdown(): Promise<void> {
        const actions: Promise<void>[] = [];

        for (const sender of this._registry.values()) {
            actions.push(sender.disconnect());
        }

        await Promise.all(actions);
        await super.shutdown();
    }

    async remove(topic: string): Promise<void> {
        const sender = this._registry.get(topic);

        if (isNotNil(sender)) {
            await sender!.disconnect();
        }
    }
}
