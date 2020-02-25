import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    ConnectionConfig,
    getValidDate,
    isString,
    TSError,
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { KafkaSenderConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';

interface Endpoint {
    producer: ProducerClient;
    data: any[];
}

type TopicMap = Map<string, Endpoint>

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    private _bufferSize: number;
    topicMap: TopicMap = new Map();
    hasConnectionMap = false;

    constructor(
        context: WorkerContext,
        opConfig: KafkaSenderConfig,
        executionConfig: ExecutionConfig
    ) {
        super(context, opConfig, executionConfig);
        const { topic, size, connection_map: connectionMap } = opConfig;

        const logger = this.logger.child({ module: 'kafka-producer' });

        this._bufferSize = size * 5;

        if (connectionMap) {
            for (const keyset of Object.keys(connectionMap)) {
                this.hasConnectionMap = true;
                const client = this.createClient(connectionMap[keyset]);
                const keys = keyset.split(',');

                for (const key of keys) {
                    const newTopic = key === '*' ? topic : `${topic}-${key}`;
                    const producer = new ProducerClient(client, {
                        logger,
                        topic: newTopic,
                        bufferSize: this._bufferSize,
                    });

                    this.topicMap.set(key, { producer, data: [] });
                }
            }
        }

        // the connection specified on opConfig must be on topicMap
        if (!this.topicMap.has(opConfig.connection)) {
            const client = this.createClient();
            const producer = new ProducerClient(client, {
                logger,
                topic,
                bufferSize: this._bufferSize,
            });
            this.topicMap.set(opConfig.connection, { producer, data: [] });
        }
    }

    async initialize() {
        await super.initialize();
        const initList = [];

        for (const { producer } of this.topicMap.values()) {
            initList.push(producer.connect());
        }

        await Promise.all(initList);
    }

    private _cleanupTopicMap() {
        for (const config of this.topicMap.values()) {
            config.data = [];
        }
    }

    async shutdown() {
        const shutdownList = [];

        for (const { producer } of this.topicMap.values()) {
            shutdownList.push(producer.disconnect());
        }

        await Promise.all(shutdownList);
        await super.shutdown();
    }

    async routeToAllTopics(batch: DataEntity[]) {
        const senders = [];

        for (const record of batch) {
            const route = record.getMetadata('standard:route');

            if (this.topicMap.has(route)) {
                const routeConfig = this.topicMap.get(route) as Endpoint;
                routeConfig.data.push(record);
            } else if (this.topicMap.has('*')) {
                const routeConfig = this.topicMap.get('*') as Endpoint;
                routeConfig.data.push(record);
            } else {
                const error = new TSError(`Invalid connection route: ${route}`);
                this.rejectRecord(record, error);
            }
        }

        for (const { data, producer } of this.topicMap.values()) {
            if (data.length > 0) {
                senders.push(producer.produce(data, this.mapFn()));
            }
        }

        await Promise.all(senders);

        this._cleanupTopicMap();
    }

    async onBatch(batch: DataEntity[]) {
        if (this.hasConnectionMap) {
            await this.routeToAllTopics(batch);
        } else {
            const { producer } = this.topicMap.get(this.opConfig.connection) as Endpoint;
            await producer.produce(batch, this.mapFn());
        }

        return batch;
    }

    private getKey(msg: DataEntity): string|null {
        if (this.opConfig.id_field) {
            const key = msg[this.opConfig.id_field];

            if (key == null) return null;

            if (!key || !isString(key)) {
                const err = new Error(`invalid id_field on record ${this.opConfig.id_field}`);
                this.rejectRecord(msg, err);
                return null;
            }

            return key;
        }

        return DataEntity.getMetadata(msg, '_key') || null;
    }

    private getTimestamp(msg: DataEntity): number|null {
        if (this.opConfig.timestamp_field) {
            const date = getValidDate(msg[this.opConfig.timestamp_field]);
            if (date) return date.getTime();

            const err = new Error(`invalid timestamp_field on record ${this.opConfig.timestamp_field}`);
            this.rejectRecord(msg, err);
        } else if (this.opConfig.timestamp_now) {
            return Date.now();
        }

        return null;
    }

    private mapFn() {
        return (msg: DataEntity): ProduceMessage => {
            const key = this.getKey(msg);
            const timestamp = this.getTimestamp(msg);
            const data = msg.toBuffer();

            return { timestamp, key, data };
        };
    }

    private clientConfig(connection?: string) {
        const config = {
            type: 'kafka',
            endpoint: connection || this.opConfig.connection,
            options: {
                type: 'producer'
            },
            rdkafka_options: {
                'compression.codec': this.opConfig.compression,
                'queue.buffering.max.messages': this._bufferSize,
                'queue.buffering.max.ms': this.opConfig.wait,
                'batch.num.messages': this.opConfig.size,
                'topic.metadata.refresh.interval.ms': this.opConfig.metadata_refresh,
                'log.connection.close': false,
                // librdkafka >1.0.0 changed the default broker acknowledgement
                // to all brokers, but this has performance issues
                'request.required.acks': this.opConfig.required_acks
            },
            autoconnect: false
        };

        const assignmentStrategy = this.opConfig.partition_assignment_strategy;
        if (assignmentStrategy) {
            config.rdkafka_options['partition.assignment.strategy'] = assignmentStrategy;
        }

        return config as ConnectionConfig;
    }

    private createClient(connection?: string): kafka.Producer {
        const config = this.clientConfig(connection);
        const { client } = this.context.foundation.getConnection(config);
        return client;
    }
}
