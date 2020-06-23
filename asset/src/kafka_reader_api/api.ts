import {
    APIFactory, AnyObject, ConnectionConfig, isNotNil
} from '@terascope/job-components';
import { ConsumerClient } from '../_kafka_clients';

export default class KafkaReaderApi extends APIFactory<ConsumerClient, AnyObject> {
    // TODO: check with schmea here
    private clientConfig(clientConfig: AnyObject) {
        const kafkaConfig = Object.assign({}, this.apiConfig, clientConfig);
        const config = {
            type: 'kafka',
            endpoint: kafkaConfig.connection,
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
                'max.poll.interval.ms': kafkaConfig.max_poll_interval,
                // Enable partition EOF because node-rdkafka
                // requires this work for consuming batches
                'enable.partition.eof': true,
            },
            autoconnect: false
        };

        const assignmentStrategy = this.apiConfig.partition_assignment_strategy;
        if (assignmentStrategy) {
            config.rdkafka_options['partition.assignment.strategy'] = assignmentStrategy;
        }

        return config as ConnectionConfig;
    }

    async create(topic: string, config: AnyObject = {}): Promise<ConsumerClient> {
        const { logger } = this;
        const clientConfig = Object.assign(
            {}, this.apiConfig, config, this.clientConfig(config), { logger, topic }
        );
        const kafkaClient = this.context.foundation.getConnection(clientConfig).client;
        const client = new ConsumerClient(kafkaClient, clientConfig);

        await client.connect();

        return client;
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
            actions.push(consumer.onFinalizing());
        }

        await Promise.all(actions);
    }

    // TODO we should handle slice retries differently now that we have the dead letter queue
    async onSliceRetry(): Promise<void> {
        const actions: Promise<void>[] = [];

        for (const consumer of this._registry.values()) {
            actions.push(consumer.onRetry());
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
