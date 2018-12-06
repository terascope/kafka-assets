import { isError } from '@terascope/job-components';
import { ProduceMessage, ProducerClientConfig } from './interfaces';
import { wrapError, AnyKafkaError } from '../_kafka_helpers';
import * as kafka from 'node-rdkafka';
import BaseClient from './base-client';

export default class ProducerClient extends BaseClient {
    private _client: kafka.Producer;
    private _topic: string;
    private _hasClientEvents = false;

    constructor(client: kafka.Producer, config: ProducerClientConfig) {
        super(config.logger);
        this._topic = config.topic;
        this._client = client;
    }

    async connect(): Promise<void> {
        if (this._client.isConnected()) return;

        this._clientEvents();
        await this._try(() => this._connect(), 'connect');

        this._logger.debug('Connected to kafka');
    }

    async disconnect(): Promise<void> {
        if (this._client.isConnected()) {
            await new Promise((resolve, reject) => {
                this._client.disconnect((err: AnyKafkaError) => {
                    if (err) reject(wrapError('Failed to disconnect', err));
                    else resolve();
                });
            });
        }

        this._client.removeAllListeners();
        super.close();
    }

    async produce<T>(messages: T[], map: (msg: T) => ProduceMessage, flushTimeout = 60000): Promise<void> {
        let error: Error|null = null;

        const off = this._once('client:error', (err) => {
            if (err) {
                error = wrapError('Client error while producing', err);
            }
        });

        for (const msg of messages) {
            const message = map(msg);

            const produceErr = this._client.produce(
                this._topic,
                // This is the partition. There may be use cases where
                // we'll need to control this.
                null,
                message.data,
                message.key,
                message.timestamp
            );

            if (isError(produceErr)) {
                error = produceErr;
            }
        }

        try {
            await this._try(() => this._flush(flushTimeout));
        } finally {
            off();
            if (error) {
                this._logger.error(error);
            }
        }
    }

    private _flush(flushTimeout: number): Promise<void> {
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

    private _clientEvents() {
        if (this._hasClientEvents) return;
        this._hasClientEvents = true;

        // for client event error logs.
        this._client.on('error', this._logOrEmit('client:error'));

        // for event error logs.
        this._client.on('event.error', this._logOrEmit('client:error'));
    }

    private _connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._client.connect({}, (err: AnyKafkaError) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}
