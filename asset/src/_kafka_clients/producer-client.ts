import { Logger } from '@terascope/job-components';
import { ProduceMessage, ProducerClientConfig } from './interfaces';
import { wrapError, AnyKafkaError } from '../_kafka_helpers';
import * as kafka from 'node-rdkafka';
import BaseClient from './base-client';

export default class ProducerClient extends BaseClient {
    private _logger: Logger;
    private _client: kafka.Producer;

    constructor(client: kafka.Producer, config: ProducerClientConfig) {
        super();
        this._logger = config.logger;
        this._client = client;
    }

    async connect(): Promise<void> {
        if (this._client.isConnected()) {
            return;
        }

        await new Promise((resolve, reject) => {
            this._client.connect({}, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to connect', err));
                } else {
                    this._logger.debug('Connected to kafka as Producer');
                    resolve();
                }
            });
        });
    }

    async disconnect(): Promise<void> {
        if (!this._client.isConnected()) {
            return;
        }

        await new Promise((resolve, reject) => {
            this._client.disconnect((err: AnyKafkaError) => {
                if (err) reject(wrapError('Failed to disconnect', err));
                else resolve();
            });
        });
    }

    produce(messages: ProduceMessage[], flushTimeout = 60000): Promise<void> {
        for (const message of messages) {
            this._client.produce(
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
            this._client.flush(flushTimeout, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to flush messages', err));
                    return;
                }
                resolve();
            });
        });
    }
}
