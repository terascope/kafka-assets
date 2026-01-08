import {
    isNotNil,
    isNil,
    isString,
    getTypeOf,
    isNumber,
    isBoolean,
    isObjectEntity
} from '@terascope/core-utils';
import { APIFactory, ConnectionConfig } from '@terascope/job-components';
import { KafkaSenderConfig } from '../kafka_sender/interfaces.js';
import KafkaRouteSender from './sender.js';
import { KafkaSenderAPIConfig } from './interfaces.js';

export default class KafkaSenderApi extends APIFactory<KafkaRouteSender, KafkaSenderAPIConfig> {
    private validateConfig(config: Record<string, any>): KafkaSenderAPIConfig {
        if (isNil(config.topic) || !isString(config.topic)) throw new Error(`Parameter topic must be provided and be of type string, got ${getTypeOf(config.topic)}`);
        if (isNil(config._connection) || !isString(config._connection)) throw new Error(`Parameter _connection must be provided and be of type string, got ${getTypeOf(config._connection)}`);
        if (isNil(config.size) || !isNumber(config.size)) throw new Error(`Parameter size must be provided and be of type number, got ${getTypeOf(config.size)}`);
        if (config.max_buffer_size !== undefined && !isNumber(config.max_buffer_size)) throw new Error(`Parameter max_buffer_size must be either undefined or be of type number, got ${getTypeOf(config.size)}`);
        if (isNotNil(config.id_field) && !isString(config.id_field)) throw new Error(`Parameter id_field must be provided and be of type string, got ${getTypeOf(config.id_field)}`);
        if (isNotNil(config.timestamp_field) && !isString(config.timestamp_field)) throw new Error(`Parameter timestamp_field must be provided and be of type string, got ${getTypeOf(config.timestamp_field)}`);
        if (isNotNil(config.timestamp_now) && !isBoolean(config.timestamp_now)) throw new Error(`Parameter timestamp_now must be provided and be of type string, got ${getTypeOf(config.timestamp_now)}`);
        if (isNil(config.compression) || !isString(config.compression)) throw new Error(`Parameter compression must be provided and be of type string, got ${getTypeOf(config.compression)}`);
        if (isNil(config.wait) || !isNumber(config.wait)) throw new Error(`Parameter wait must be provided and be of type number, got ${getTypeOf(config.wait)}`);
        if (isNil(config.metadata_refresh) || !isNumber(config.metadata_refresh)) throw new Error(`Parameter metadata_refresh must be provided and be of type number, got ${getTypeOf(config.metadata_refresh)}`);
        if (isNil(config.required_acks) || !isNumber(config.required_acks)) throw new Error(`Parameter required_acks must be provided and be of type number, got ${getTypeOf(config.required_acks)}`);
        if (isNil(config.logger)) throw new Error(`Parameter logger must be provided and be of type Logger, got ${getTypeOf(config.logger)}`);
        // Since we don't validate this key with convict
        // we don't have the benifit of setting a default. So we set it here
        if (isNil(config.rdkafka_options) || !isObjectEntity(config.rdkafka_options)) {
            config.rdkafka_options = {};
        }

        return config;
    }

    private clientConfig(clientConfig: KafkaSenderAPIConfig = {}) {
        const kafkaConfig = Object.assign({}, this.apiConfig, clientConfig);
        const config = {
            type: 'kafka',
            endpoint: kafkaConfig._connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': kafkaConfig.compression,
                ...(kafkaConfig.max_buffer_kbytes_size !== undefined
                    ? { 'queue.buffering.max.kbytes': kafkaConfig.max_buffer_kbytes_size }
                    : {}),
                ...(kafkaConfig.max_buffer_size !== undefined
                    ? { 'queue.buffering.max.messages': kafkaConfig.max_buffer_size }
                    : {}),
                'queue.buffering.max.ms': kafkaConfig.wait,
                'batch.num.messages': kafkaConfig.size,
                'topic.metadata.refresh.interval.ms': kafkaConfig.metadata_refresh,
                'log.connection.close': false,
                // librdkafka >1.0.0 changed the default broker acknowledgement
                // to all brokers, but this has performance issues
                'request.required.acks': kafkaConfig.required_acks,
                ...kafkaConfig.rdkafka_options
            } as Record<string, any>,
            autoconnect: false
        };
        return config as ConnectionConfig;
    }

    async create(
        _connection: string, config: Partial<KafkaSenderConfig> = {}
    ): Promise<{ client: KafkaRouteSender; config: KafkaSenderAPIConfig }> {
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

        // maxBufferLength is used as an indicator of when to flush the queue in producer-client.ts
        // in addition to the max.messages setting
        if (kafkaClient.globalConfig['queue.buffering.max.messages']) {
            validConfig.maxBufferLength = kafkaClient.globalConfig['queue.buffering.max.messages'];
        } else {
            // If we don't see it on the client globals then set default stated here:
            // https://github.com/confluentinc/librdkafka/blob/master/CONFIGURATION.md
            validConfig.maxBufferLength = 100000;
        }
        // maxBufferKilobyteSize is also used as an indicator of when to flush the queue
        if (kafkaClient.globalConfig['queue.buffering.max.kbytes']) {
            validConfig.maxBufferKilobyteSize = kafkaClient.globalConfig['queue.buffering.max.kbytes'];
        } else {
            // If we don't see it on the client globals then set default stated here:
            // https://github.com/confluentinc/librdkafka/blob/master/CONFIGURATION.md
            validConfig.maxBufferKilobyteSize = 1048576;
        }

        logger.debug(`Kafka Producer Client Configuration: \n${JSON.stringify(
            {
                ...clientConfig,
                rdkafka_options: {
                    ...((clientConfig as Record<string, any>).rdkafka_options ?? {}),
                    'queue.buffering.max.messages': validConfig.maxBufferLength,
                    'queue.buffering.max.kbytes': validConfig.maxBufferKilobyteSize,
                },

            },
            null,
            2
        )}`);

        validConfig.tryFn = this.tryRecord.bind(this);

        const client = new KafkaRouteSender(
            kafkaClient,
            validConfig,
            this.context
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
