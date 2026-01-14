import {
    DataEntity,
    getValidDate,
    isString,
    Logger,
    toString,
    TSError
} from '@terascope/core-utils';
import { RouteSenderAPI, isPromAvailable, Context } from '@terascope/job-components';
import kafka from '@confluentinc/kafka-javascript';
import { KafkaSenderAPIConfig } from './interfaces.js';
import { ProducerClient, ProduceMessage } from '../_kafka_clients/index.js';

type FN = (input: any) => any;

export default class KafkaSender implements RouteSenderAPI {
    logger: Logger;
    producer: ProducerClient;
    context: Context;
    readonly hasConnected = false;
    readonly config: KafkaSenderAPIConfig = {};
    readonly isWildcard: boolean;
    private tryFn: (msg: any, err: any) => DataEntity | null;
    readonly pathList = new Map<string, boolean>();
    readonly mapper: (msg: DataEntity) => ProduceMessage;

    constructor(client: kafka.Producer, config: KafkaSenderAPIConfig, context: Context) {
        const producer = new ProducerClient(client, {
            logger: config.logger,
            topic: config.topicOverride || config.topic,
            maxBufferLength: config.max_buffer_size,
            maxBufferKilobyteSize: config.max_buffer_kbytes_size
        });

        this.config = config;
        this.isWildcard = config._key && config._key === '**';
        this.producer = producer;
        this.tryFn = config.tryFn || this.tryCatch;
        this.mapper = this.mapFn.bind(this);
        this.logger = config.logger;
        this.context = context;
    }

    private tryCatch(fn: FN) {
        return (input: any) => {
            try {
                return fn(input);
            } catch (err) {
                throw new TSError(err, {
                    message: `Error computing ${toString(input)}`
                });
            }
        };
    }

    async initialize(): Promise<void> {
        const { context, producer, config } = this;
        if (isPromAvailable(context)) {
            context.apis.foundation.promMetrics.addGauge(
                'kafka_bytes_produced',
                'Number of bytes the kafka producer has produced',
                ['op_name'],
                async function collect() {
                    const bytesProduced = await producer.getBytesProduced();
                    const labels = {
                        op_name: config._op,
                        ...context.apis.foundation.promMetrics.getDefaultLabels()
                    };
                    this.set(labels, bytesProduced);
                }
            );
        }
        await this.producer.connect();
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
    }

    async send(data: Iterable<DataEntity>): Promise<number> {
        const records = Array.isArray(data) ? data : Array.from(data);
        await this.producer.produce(records, this.mapper);
        return records.length;
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

    private getKey(msg: DataEntity): string | null {
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

        if (DataEntity.isDataEntity(msg)) {
            if (typeof msg.getKey === 'function') {
                try {
                    return String(msg.getKey());
                } catch (err) {
                    // ignore the error
                }
            }
            const metadataKey = msg.getMetadata('_key');
            if (metadataKey != null) return String(metadataKey);
        }

        if ('_key' in msg) return msg._key;
        return null;
    }

    private getTimestamp(msg: DataEntity): number | null {
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

    private getRouteTopic(msg: DataEntity): string | null {
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
