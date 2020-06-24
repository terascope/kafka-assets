import {
    RouteSenderAPI, AnyObject, DataEntity, getValidDate, isString
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';

export default class KafkaSender implements RouteSenderAPI {
    producer: ProducerClient;
    hasConnected = false;
    config: AnyObject = {};

    constructor(client: kafka.Producer, config: AnyObject) {
        const producer = new ProducerClient(client, {
            logger: config.kafkaLogger,
            topic: config.topicOverride || config.topic,
            bufferSize: config.bufferSize,
        });
        this.producer = producer;
    }

    async initialize(): Promise<void> {
        await this.producer.connect();
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async send(data: DataEntity[], tryFN: any, topicKey?: string): Promise<void> {
        const resutls = await this.producer.produce(data, this.mapFn(tryFN, topicKey));
        return resutls;
    }

    private mapFn(tryFN: any, topicKey?: string) {
        return (msg: DataEntity): ProduceMessage => {
            const key = this.getKey(msg, tryFN);
            const timestamp = this.getTimestamp(msg, tryFN);
            const data = msg.toBuffer();
            const topic = this.getRouteTopic(msg, topicKey);

            return {
                timestamp, key, data, topic
            };
        };
    }

    private getKey(msg: DataEntity, tryFN: any): string|null {
        if (this.config.id_field) {
            const key = msg[this.config.id_field];

            if (key == null) return null;

            if (!key || !isString(key)) {
                const err = new Error(`invalid id_field on record ${this.config.id_field}`);
                tryFN(msg, err);
                return null;
            }

            return key;
        }

        return DataEntity.getMetadata(msg, '_key') || null;
    }

    private getTimestamp(msg: DataEntity, tryFn: any): number|null {
        if (this.config.timestamp_field) {
            const date = getValidDate(msg[this.config.timestamp_field]);
            if (date) return date.getTime();

            const err = new Error(`invalid timestamp_field on record ${this.config.timestamp_field}`);
            tryFn(msg, err);
        } else if (this.config.timestamp_now) {
            return Date.now();
        }

        return null;
    }

    private getRouteTopic(msg: DataEntity, topicKey?: string): string|null {
        if (topicKey === '**') {
            const route = msg.getMetadata('standard:route');
            if (route) {
                return `${this.config.topic}-${route}`;
            }
            return this.config.topic;
        }
        return null;
    }

    async verify(): Promise<void> {
        await this.producer.getMetadata(this.config.topic);
    }
}
