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
import { APIConsumer } from '../_kafka_clients/index.js';
import { KafkaReaderConfig } from '../kafka_reader/interfaces.js';
import { KafkaReaderAPIConfig } from './interfaces.js';

export default class KafkaReaderApi extends APIFactory<APIConsumer, KafkaReaderAPIConfig> {
    private validateConfig(config: Record<string, any>): KafkaReaderAPIConfig {
        if (isNil(config.topic) || !isString(config.topic)) throw new Error(`Parameter topic must be provided and be of type string, got ${getTypeOf(config.topic)}`);
        if (isNil(config._connection) || !isString(config._connection)) throw new Error(`Parameter _connection must be provided and be of type string, got ${getTypeOf(config._connection)}`);
        if (isNil(config.group) || !isString(config.group)) throw new Error(`Parameter group must be provided and be of type string, got ${getTypeOf(config.group)}`);
        if (isNil(config.offset_reset) || !isString(config.offset_reset)) throw new Error(`Parameter offset_reset must be provided and be of type string, got ${getTypeOf(config.offset_reset)}`);
        if (isNil(config.size) || !isNumber(config.size)) throw new Error(`Parameter size must be provided and be of type number, got ${getTypeOf(config.size)}`);
        if (isNil(config.wait) || !isNumber(config.wait)) throw new Error(`Parameter wait must be provided and be of type number, got ${getTypeOf(config.wait)}`);
        if (config.max_poll_interval !== undefined && !isNumber(config.max_poll_interval)) throw new Error(`Parameter max_poll_interval must either be undefined or of type number, got ${getTypeOf(config.max_poll_interval)}`);
        if (isNil(config.use_commit_sync) || !isBoolean(config.use_commit_sync)) throw new Error(`Parameter use_commit_sync must be provided and be of type boolean, got ${getTypeOf(config.use_commit_sync)}`);
        if (isNil(config.rollback_on_failure) || !isBoolean(config.rollback_on_failure)) throw new Error(`Parameter rollback_on_failure must be provided and be of type boolean, got ${getTypeOf(config.rollback_on_failure)}`);
        if (isNil(config.partition_assignment_strategy) || !isString(config.partition_assignment_strategy)) throw new Error(`Parameter partition_assignment_strategy must be provided and be of type string, got ${getTypeOf(config.partition_assignment_strategy)}`);
        if (isNotNil(config._encoding) && !isString(config._encoding)) throw new Error(`Parameter _encoding must be provided and be of type string, got ${getTypeOf(config._encoding)}`);
        // Since we don't validate this key with convict
        // we don't have the benifit of setting a default. So we set it here
        if (isNil(config.rdkafka_options) || !isObjectEntity(config.rdkafka_options)) {
            config.rdkafka_options = {};
        }
        return config as KafkaReaderAPIConfig;
    }

    private clientConfig(clientConfig: KafkaReaderAPIConfig) {
        const kafkaConfig = Object.assign({}, this.apiConfig, clientConfig);
        const config = {
            type: 'kafka',
            endpoint: kafkaConfig._connection,
            options: {
                type: 'consumer',
                group: kafkaConfig.group
            },
            topic_options: {
                'auto.offset.reset': kafkaConfig.offset_reset
            },
            rdkafka_options: {
                // Explicitly manage offset commits.
                'enable.auto.commit': false,
                'enable.auto.offset.store': false,
                'queued.min.messages': 2 * kafkaConfig.size,
                // Capture the rebalances for better error handling and debug
                rebalance_cb: true,
                // Capture the commits for better error handling and debug
                offset_commit_cb: true,
                // Set the max.poll.interval.ms
                // Only include this key if it's defined
                ...(kafkaConfig.max_poll_interval !== undefined
                    ? { 'max.poll.interval.ms': kafkaConfig.max_poll_interval }
                    : {}),
                // Enable partition EOF because node-rdkafka
                // requires this work for consuming batches
                'enable.partition.eof': true,
                ...kafkaConfig.rdkafka_options
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
        _name: string, config: Partial<KafkaReaderConfig> = {}
    ): Promise<{ client: APIConsumer; config: KafkaReaderAPIConfig }> {
        const logger = config.logger || this.logger;
        const newConfig = Object.assign(
            {}, this.apiConfig, config, { logger }
        );

        const validConfig = this.validateConfig(newConfig);
        const clientConfig = this.clientConfig(validConfig);

        logger.debug(`Kafka Consumer Client Configuration: \n${JSON.stringify(clientConfig, null, 2)}`);

        const { client: kafkaClient } = await this.context.apis.foundation.createClient(
            clientConfig
        );

        logger.debug(`Kafka Consumer Client Configuration: \n${JSON.stringify(
            {
                ...clientConfig,
                rdkafka_options: {
                    ...((clientConfig as Record<string, any>).rdkafka_options ?? {}),
                    ...(kafkaClient.globalConfig['max.poll.interval.ms'] !== undefined
                        ? { 'max.poll.interval.ms': kafkaClient.globalConfig['max.poll.interval.ms'] }
                        : { 'max.poll.interval.ms': 300000 })
                },
            },
            null,
            2
        )}`);

        const tryFn = this.tryRecord.bind(this);
        const client = new APIConsumer(kafkaClient, {
            ...validConfig,
            logger,
            tryFn,
        });

        await client.connect();

        return { client, config: validConfig };
    }

    async shutdown(): Promise<void> {
        const actions: Promise<void>[] = [];

        for (const consumer of this._registry.values()) {
            consumer.handlePendingCommits();
            actions.push(consumer.disconnect());
        }

        await Promise.all(actions);
        await super.shutdown();
    }

    async onSliceFinalizing(): Promise<void> {
        const actions: Promise<void>[] = [];

        for (const consumer of this._registry.values()) {
            actions.push(consumer.commit());
        }

        await Promise.all(actions);
    }

    // TODO we should handle slice retries differently now that we have the dead letter queue
    async onSliceRetry(): Promise<void> {
        const actions: Promise<void>[] = [];

        for (const consumer of this._registry.values()) {
            actions.push(consumer.retry());
        }

        await Promise.all(actions);
    }

    async remove(topic: string): Promise<void> {
        const client = this._registry.get(topic);

        if (isNotNil(client)) {
            client!.handlePendingCommits();
            await client?.disconnect();
        }
    }
}
