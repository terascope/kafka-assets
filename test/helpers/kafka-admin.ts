import { debugLogger, pDelay, castArray } from '@terascope/core-utils';
import kafka from '@confluentinc/kafka-javascript';
import { ERR_UNKNOWN_TOPIC_OR_PART } from '../../asset/src/_kafka_helpers/error-codes.js';
import { isKafkaError } from '../../asset/src/_kafka_helpers/index.js';
import { kafkaBrokers, sslRdkafkaOptions } from './config.js';

const logger = debugLogger('test-kafka-admin');

export default class KafkaAdmin {
    private _client: kafka.IAdminClient;

    constructor() {
        this._client = kafka.AdminClient.create({
            'metadata.broker.list': castArray(kafkaBrokers).join(','),
            ...sslRdkafkaOptions,
        });
    }

    async ensureTopic(topic: string | kafka.NewTopic): Promise<void> {
        logger.debug(`ensuring topic "${topic}"...`);

        const topicName = typeof topic === 'string' ? topic : topic.topic;

        try {
            await this.deleteTopic(topicName);
            await this.waitForTopicDeletion(topicName);
        } catch (err) {
            if (!isKafkaError(err) || err.code !== ERR_UNKNOWN_TOPIC_OR_PART) {
                throw err;
            }
        }

        await this.createTopic(topic);

        logger.debug(`ensured topic "${topicName}" is new`);
    }

    private async waitForTopicDeletion(topicName: string): Promise<void> {
        while (true) {
            const topics = await this.listTopics();
            if (!topics.includes(topicName)) return;
            await pDelay(100);
        }
    }

    async listTopics(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            this._client.listTopics((err, topics) => {
                if (err) reject(err);
                else resolve(topics);
            });
        });
    }

    private createTopic(topic: string | kafka.NewTopic) {
        return new Promise<void>((resolve, reject) => {
            let newTopic: kafka.NewTopic;
            if (typeof topic === 'string') {
                newTopic = {
                    topic,
                    num_partitions: 1,
                    replication_factor: 1,
                    config: {},
                };
            } else {
                newTopic = topic;
            }
            this._client.createTopic(newTopic, (err) => {
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
