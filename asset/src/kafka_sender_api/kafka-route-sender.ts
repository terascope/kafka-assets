import {
    RouteSenderAPI, AnyObject, DataEntity, getValidDate, isString, Logger, toString
} from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { ProducerClient, ProduceMessage } from '../_kafka_clients';

export default class KafkaSender implements RouteSenderAPI {
    logger: Logger;
    producer: ProducerClient;
    readonly hasConnected = false;
    readonly config: AnyObject = {};
    readonly isWildcard: boolean;
    private tryFn: (msg: any, err: any) => DataEntity|null;

    constructor(client: kafka.Producer, config: AnyObject) {
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

    private tryCatch(fn: any) {
        return (input: any) => {
            try {
                return fn(input);
            } catch (err) {
                this.logger.warn(`Error computing ${toString(input)}, error: ${err.message}`)
                return null;
            }
        };
    }

    async initialize(): Promise<void> {
        await this.producer.connect();
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async send(data: DataEntity[]): Promise<void> {
        const mapper = this.mapFn.bind(this);
        const resutls = await this.producer.produce(data, mapper);
        return resutls;
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
        await this.producer.getMetadata(topic);
    }
}
