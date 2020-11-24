import { debugLogger, pDelay, castArray } from '@terascope/job-components';
import { AdminClient, IAdminClient } from 'node-rdkafka';
import { ERR_UNKNOWN_TOPIC_OR_PART } from '../../asset/src/_kafka_helpers/error-codes';
import { kafkaBrokers } from './config';

const logger = debugLogger('test-kafka-admin');

export default class KafkaAdmin {
    private _client: IAdminClient;

    constructor() {
        this._client = AdminClient.create({
            'metadata.broker.list': castArray(kafkaBrokers).join(','),
        });
    }

    async ensureTopic(topic: string): Promise<void> {
        logger.debug(`ensuring topic "${topic}"...`);

        try {
            await this.deleteTopic(topic);
            await pDelay(500);
        } catch (err) {
            if (err.code !== ERR_UNKNOWN_TOPIC_OR_PART) {
                throw err;
            }
        }

        await this.createTopic(topic);

        logger.debug(`ensured topic "${topic}" is new`);
    }

    private createTopic(topic: string) {
        return new Promise<void>((resolve, reject) => {
            this._client.createTopic({
                topic,
                num_partitions: 1,
                replication_factor: 1,
                config: {},
            }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private deleteTopic(topic: string) {
        return new Promise<void>((resolve, reject) => {
            this._client.deleteTopic(topic, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    disconnect(): void {
        this._client.disconnect();
    }
}
