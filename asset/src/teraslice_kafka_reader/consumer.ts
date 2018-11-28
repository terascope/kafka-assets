import { WorkerContext, ConnectionConfig } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';
import { wrapError } from '../helpers';
import { KafkaConsumer } from 'node-rdkafka';

export default class Consumer {
    private context: WorkerContext;
    private opConfig: KafkaReaderConfig;
    private client: KafkaConsumer;

    constructor(context: WorkerContext, opConfig: KafkaReaderConfig) {
        this.context = context;
        this.opConfig = opConfig;
        this.client = this.createClient();
    }

    connect(): Promise<void> {
        if (this.client.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.client.connect({}, (err) => {
                if (err) reject(wrapError('Failed to connect', err));
                else resolve();
            });
        });
    }

    disconnect(): Promise<void> {
        if (!this.client.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.client.disconnect((err) => {
                if (err) reject(wrapError('Failed to disconnect', err));
                else resolve();
            });
        });
    }

    private createClient(): KafkaConsumer {
        const config = {
            type: 'kafka',
            endpoint: this.opConfig.connection,
            options: {
                type: 'consumer',
                group: this.opConfig.group
            },
            topic_options: {
                'auto.offset.reset': this.opConfig.offset_reset
            },
            rdkafka_options: {
                // We want to explicitly manage offset commits.
                'enable.auto.commit': false,
                'enable.auto.offset.store': false,
                'queued.min.messages': 2 * this.opConfig.size
            },
            autoconnect: false
        } as ConnectionConfig;

        const connection = this.context.foundation.getConnection(config);
        return connection.client;
    }
}
