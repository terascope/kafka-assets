import { debugLogger, pDelay } from '@terascope/job-components';
import { AdminClient, InternalAdminClient } from 'node-rdkafka';
import { ERR_UNKNOWN_TOPIC_OR_PART } from '../../asset/src/_kafka_helpers/error-codes';
import { kafkaBrokers } from './config';

const logger = debugLogger('test-kafka-admin');

export default class KafkaAdmin {
    private _client: InternalAdminClient;

    constructor() {
        // @ts-ignore because node-rdkafka type definitions are terrible
        this._client = AdminClient.create({
            'metadata.broker.list': kafkaBrokers,
        });
    }

    async ensureTopic(topic: string) {
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
        return new Promise((resolve, reject) => {
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
        return new Promise((resolve, reject) => {
            this._client.deleteTopic(topic, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    disconnect() {
        this._client.disconnect();
    }
}