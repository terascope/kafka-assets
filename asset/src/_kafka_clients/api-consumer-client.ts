import type * as kafka from 'node-rdkafka';
import {
    DataEntity, TSError, toString, isError
} from '@terascope/job-components';
import Consumer from './consumer-client';
import { KafkaMessage, KafkaMessageMetadata } from '../_kafka_helpers';
import { ConsumerClientConfig, ConsumeFn } from './interfaces';

export default class APIConsumer extends Consumer {
    tryFn: ConsumeFn;
    processKafkaRecord: (msg: KafkaMessage) => DataEntity;
    mapper: (msg: KafkaMessage) => DataEntity;

    constructor(client: kafka.KafkaConsumer, config: ConsumerClientConfig) {
        super(client, config);
        this.tryFn = config.tryFn || this.tryCatch;
        this.processKafkaRecord = (msg: KafkaMessage): DataEntity => {
            const now = Date.now();

            const metadata: KafkaMessageMetadata = {
                _key: keyToString(msg.key),
                _ingestTime: msg.timestamp || now,
                _processTime: now,
                // TODO this should be based of an actual value
                _eventTime: now,
                topic: msg.topic,
                partition: msg.partition,
                offset: msg.offset,
                size: msg.size,
            };

            return DataEntity.fromBuffer(
                msg.value as string|Buffer,
                this.encoding,
                metadata
            );
        };

        this.mapper = this.tryFn(this.processKafkaRecord);
    }

    private tryCatch(fn: (input: any) => any) {
        return (input: any) => {
            try {
                return fn(input);
            } catch (err) {
                throw new TSError(`Error computing ${toString(input)}`, {
                    reason: isError(err) ? err.message : String(err)
                });
            }
        };
    }

    // @ts-expect-error
    async consume(query: { size: number; wait: number }): Promise<DataEntity[]> {
        return super.consume<DataEntity>(this.mapper as any, query);
    }
}

/** Safely convert a buffer or string to a string */
function keyToString(str?: kafka.MessageKey) {
    if (!str) return undefined;
    return str.toString('utf8');
}
