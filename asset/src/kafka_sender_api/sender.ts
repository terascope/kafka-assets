import {
    RouteSenderAPI,
    DataEntity,
    getValidDate,
    isString,
    Logger,
    toString,
    TSError
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { KafkaSenderAPIConfig } from './interfaces';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';

type FN = (input: any) => any;

export default class KafkaSender implements RouteSenderAPI {
    logger: Logger;
    producer: ProducerClient;
    readonly hasConnected = false;
    readonly config: KafkaSenderAPIConfig = {};
    readonly isWildcard: boolean;
    private tryFn: (msg: any, err: any) => DataEntity|null;
    readonly pathList = new Map<string, boolean>();

    constructor(client: kafka.Producer, config: KafkaSenderAPIConfig) {
        const producer = new ProducerClient(client, {
            logger: config.logger,
            topic: config.topicOverride || config.topic,
            bufferSize: config.bufferSize,
        });

        this.config = config;
        this.isWildcard = config._key && config._key === '**';
        this.producer = producer;
        this.tryFn = config.tryFn || this.tryCatch;
        this.logger = config.logger;
    }

    private tryCatch(fn: FN) {
        return (input: any) => {
            try {
                return fn(input);
            } catch (err) {
                throw new TSError(`Error computing ${toString(input)}`, { reason: err.message });
            }
        };
    }

    async initialize(): Promise<void> {
        await this.producer.connect();
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }

    async send(data: DataEntity[]): Promise<void> {
        const mapper = this.mapFn.bind(this);
        await this.producer.produce(data, mapper);
    }

    private mapFn(msg: DataEntity): ProduceMessage {
        const key = this.getKey(msg);
        const timestamp = this.getTimestamp(msg);
        const data = msg.toBuffer();
        const topic = this.getRouteTopic(msg);

        return {
            timestamp, key, data, topic
        };
    }

    private getKey(msg: DataEntity): string|null {
        if (this.config.id_field) {
            const key = msg[this.config.id_field];

            if (key == null) return null;

            if (!key || !isString(key)) {
                const err = new Error(`invalid id_field on record ${this.config.id_field}`);
                this.tryFn(msg, err);
                return null;
            }

            return key;
        }

        return DataEntity.getMetadata(msg, '_key') || null;
    }

    private getTimestamp(msg: DataEntity): number|null {
        if (this.config.timestamp_field) {
            const date = getValidDate(msg[this.config.timestamp_field]);
            if (date) return date.getTime();

            const err = new Error(`invalid timestamp_field on record ${this.config.timestamp_field}`);
            this.tryFn(msg, err);
        } else if (this.config.timestamp_now) {
            return Date.now();
        }

        return null;
    }

    private getRouteTopic(msg: DataEntity): string|null {
        if (this.isWildcard) {
            const route = msg.getMetadata('standard:route');

            if (route) {
                return `${this.config.topic}-${route}`;
            }
            return this.config.topic;
        }
        return null;
    }

    async verify(route?: string): Promise<void> {
        const topic = route ? `${this.config.topic}-${route}` : this.config.topic;
        if (!this.pathList.has(topic)) {
            await this.producer.getMetadata(topic);
            this.pathList.set(topic, true);
        }
    }
}