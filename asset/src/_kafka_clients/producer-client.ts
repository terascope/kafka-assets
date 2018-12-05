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
        if (this._client.isConnected()) {
            return;
        }

        this._clientEvents();

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

            this._client.produce(
                this._topic,
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
                off();

                if (error) {
                    this._logger.error(err);
                }

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
        this._client.on('error', (err) => {
            this._logOrEmit('client:error', err);
        });

        // for event error logs.
        this._client.on('event.error', (err) => {
            this._logOrEmit('client:error', err);
        });
    }
}
