import { Logger } from '@terascope/job-components';
import { ProduceMessage } from './interfaces';
import { wrapError, AnyKafkaError } from '../helpers';
import * as kafka from 'node-rdkafka';

export default class ProducerClient {
    private logger: Logger;
    private client: kafka.Producer;

    constructor(client: kafka.Producer, logger: Logger) {
        this.logger = logger;
        this.client = client;
    }

    connect(): Promise<void> {
        if (this.client.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.client.connect({}, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to connect', err));
                } else {
                    this.logger.debug('Connected to kafka as Producer');
                    resolve();
                }
            });
        });
    }

    disconnect(): Promise<void> {
        if (!this.client.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.client.disconnect((err: AnyKafkaError) => {
                if (err) reject(wrapError('Failed to disconnect', err));
                else resolve();
            });
        });
    }

    produce(messages: ProduceMessage[], flushTimeout = 60000): Promise<void> {
        for (const message of messages) {
            this.client.produce(
                message.topic,
                // This is the partition. There may be use cases where
                // we'll need to control this.
                null,
                message.data,
                message.key,
                message.timestamp
            );
        }

        return new Promise((resolve, reject) => {
            this.client.flush(flushTimeout, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to flush messages', err));
                    return;
                }
                resolve();
            });
        });
    }
}
