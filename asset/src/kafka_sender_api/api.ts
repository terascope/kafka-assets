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
import { ProducerTopicConfig, ProducerGlobalConfig } from '@confluentinc/kafka-javascript';

// Defaults are based off of librdkafka defaults.
// https://github.com/confluentinc/librdkafka/blob/master/CONFIGURATION.md
const DEFAULT_MAX_BUFFER_LENGTH = 100000;
const DEFAULT_MAX_BUFFER_KILOBYTE_SIZE = 1048576;

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
        if (isNotNil(config.queue_backpressure_strategy) && !['threshold_flush', 'retry_on_full'].includes(config.queue_backpressure_strategy)) throw new Error(`Parameter queue_backpressure_strategy must be either "threshold_flush" or "retry_on_full", got ${config.queue_backpressure_strategy}`);
        if (isNil(config.rdkafka_options) || !isObjectEntity(config.rdkafka_options)) throw new Error(`Parameter rdkafka_options must be provided and be of type Object, got ${getTypeOf(config.rdkafka_options)}`);
        if (config.delivery_report) {
            if (isNil(config.delivery_report.wait) || !isBoolean(config.delivery_report.wait)) throw new Error(`Parameter delivery_report.wait must be provided and be of type boolean, got ${getTypeOf(config.delivery_report.wait)}`);
            if (config.delivery_report.wait === true) {
                if (isNil(config.delivery_report.waitTimeout) || !isNumber(config.delivery_report.waitTimeout)) throw new Error(`Parameter delivery_report.waitTimeout must be provided if 'wait' is true and must be of type number, got ${getTypeOf(config.delivery_report.waitTimeout)}`);
            }
            if (isNil(config.delivery_report.only_error) || !isBoolean(config.delivery_report.only_error)) throw new Error(`Parameter delivery_report.only_error must be provided and be of type boolean, got ${getTypeOf(config.delivery_report.only_error)}`);
            if (isNil(config.delivery_report.on_error) || !['log', 'throw', 'ignore'].includes(config.delivery_report.on_error)) throw new Error(`Parameter delivery_report.on_error must be provided and be one of ['log', 'throw', 'ignore'], got ${getTypeOf(config.delivery_report.on_error)}`);
        }

        const rd_opts: ProducerTopicConfig & ProducerGlobalConfig = config.rdkafka_options;
        if (rd_opts.dr_cb === true && config.required_acks === 0) {
            this.logger.warn('KafkaSenderApi config has dr_cb enabled, but required_acks set to 0.'
                + ' Delivery reports will only guarantee the message was sent.');
        }
        if (rd_opts.dr_msg_cb === true && config.required_acks === 0) {
            this.logger.warn('KafkaSenderApi config has dr_msg_cb enabled, but required_acks set to 0.'
                + ' Delivery reports will only guarantee the message was sent.');
        }
        if (config.delivery_report) {
            if (rd_opts.dr_cb === undefined && rd_opts.dr_msg_cb === undefined) {
                rd_opts.dr_cb = true;
            }
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
                // Emit librdkafka stats events every 100ms when using retry_on_full strategy.
                // Without this, no 'event.stats' events fire and the flush-retry logic in
                // ProducerClient would hang indefinitely.
                ...(kafkaConfig.queue_backpressure_strategy === 'retry_on_full'
                    ? { 'statistics.interval.ms': 100 }
                    : {}),
                // librdkafka >1.0.0 changed the default broker acknowledgement
                // to all brokers, but this has performance issues
                'request.required.acks': kafkaConfig.required_acks,
                ...kafkaConfig.rdkafka_options
            } as Record<string, any>,
            autoconnect: false
        };
        return config as ConnectionConfig;
    }

    private adminClientConfig(clientConfig: KafkaSenderAPIConfig = {}) {
        const kafkaConfig = Object.assign({}, this.apiConfig, clientConfig);
        const config = {
            type: 'kafka',
            endpoint: kafkaConfig._connection,
            options: {
                type: 'admin'
            },
            rdkafka_options: {
                'topic.metadata.refresh.interval.ms': kafkaConfig.metadata_refresh,
                'log.connection.close': false,
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
        const adminClientConfig = this.adminClientConfig(validConfig);

        const { client: adminClient } = await this.context.apis.foundation.createClient(
            adminClientConfig
        );

        const { client: kafkaClient } = await this.context.apis.foundation.createClient(
            clientConfig
        );

        // maxBufferLength is used as an indicator of when to flush the queue in producer-client.ts
        // in addition to the max.messages setting
        if (kafkaClient.globalConfig['queue.buffering.max.messages']) {
            validConfig.maxBufferLength = kafkaClient.globalConfig['queue.buffering.max.messages'];
        } else {
            // If we don't see it on the client globals then set default stated here
            validConfig.maxBufferLength = DEFAULT_MAX_BUFFER_LENGTH;
        }
        // maxBufferKilobyteSize is also used as an indicator of when to flush the queue
        if (kafkaClient.globalConfig['queue.buffering.max.kbytes']) {
            validConfig.maxBufferKilobyteSize = kafkaClient.globalConfig['queue.buffering.max.kbytes'];
        } else {
            // If we don't see it on the client globals then set default stated here
            validConfig.maxBufferKilobyteSize = DEFAULT_MAX_BUFFER_KILOBYTE_SIZE;
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
            this.context,
            adminClient
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
