import omit from 'lodash.omit';
import { Logger, DataEntity } from '@terascope/job-components';
import {
    wrapError,
    AnyKafkaError,
    KafkaMessage,
    isOkayError,
    KafkaMessageMetadata
} from '../helpers';
import * as kafka from 'node-rdkafka';
import { KafkaReaderConfig } from './interfaces';

export default class ConsumerClient {
    private logger: Logger;
    private client: kafka.KafkaConsumer;
    private opConfig: KafkaReaderConfig;

    constructor(client: kafka.KafkaConsumer, logger: Logger, opConfig: KafkaReaderConfig) {
        this.logger = logger;
        this.client = client;
        this.opConfig = opConfig;
    }

    async connect(): Promise<void> {
        if (this.client.isConnected()) {
            return Promise.resolve();
        }

        this._onReady();
        await this._connect();
    }

    async consume(): Promise<DataEntity[]> {
        const endAt = Date.now() + this.opConfig.wait;
        let results: DataEntity[] = [];

        while (results.length < this.opConfig.size && endAt > Date.now()) {
            const remaining = this.opConfig.size - results.length;
            const remainingMs = endAt - Date.now();
            const timeout = remainingMs > 0 ? remainingMs : 0;

            this.client.setDefaultConsumeTimeout(timeout);

            const consumed = await this._consume(remaining);
            results = results.concat(consumed);
        }

        return results;
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

    private _consume(count: number): Promise<DataEntity[]> {
        return new Promise((resolve, reject) => {
            const results: DataEntity[] = [];

            this.logger.info(`Consuming count ${count}`);
            this.client.consume(count, (err: AnyKafkaError, messages: KafkaMessage[]) => {
                if (err) {
                    if (!isOkayError(err)) {
                        reject(err);
                        return;
                    }
                    return;
                }

                this.logger.trace(`consumed ${messages.length} messages`);
                for (const message of messages) {
                    const entity = this._handleMessage(message);
                    if (entity != null) {
                        results.push(entity);
                    }
                }

                resolve(results);
            });
        });
    }

    private _handleMessage(message: KafkaMessage): DataEntity|null {
        const metadata: KafkaMessageMetadata = omit(message, 'value');

        try {
            return DataEntity.fromBuffer(
                message.value,
                this.opConfig,
                metadata
            );
        } catch (err) {
            if (this.opConfig.bad_record_action === 'log') {
                this.logger.error('Bad record', message);
                this.logger.error(err);
            } else if (this.opConfig.bad_record_action === 'throw') {
                throw err;
            }

            return null;
        }
    }

    private _connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.connect({}, (err: AnyKafkaError) => {
                if (err) {
                    reject(wrapError('Failed to connect', err));
                } else {
                    this.logger.debug('Connected to kafka as Consumer');
                    resolve();
                }
            });
        });
    }

    private _onReady() {
        this.client.on('ready', () => {
            this.logger.info('Consumer ready');
            this.client.subscribe([this.opConfig.topic]);

            // for debug logs.
            this.client.on('event.log', (event) => {
                this.logger.info(event);
            });
        });
    }
}
