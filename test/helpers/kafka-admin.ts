import uuidv4 from 'uuid/v4';
import { promisify } from 'util';
// @ts-ignore
import { kafka } from 'kafka-tools';
import { debugLogger } from '@terascope/job-components';

const delay = promisify(setTimeout);

const logger = debugLogger('test-kafka-admin');

export default class KafkaAdmin {
    // @ts-ignore
    private client: kafka.Client;

    constructor() {
        this.client = new kafka.Client('localhost:2181', uuidv4(), {
            sessionTimeout: 5000,
            spinDelay: 500,
            retries: 0
        });
    }

    async ensureTopic(topic: string) {
        try {
            await this.deleteTopic(topic);
            logger.info(`deleted topic ${topic}`);
        } catch (err) {
            logger.warn('got okay error when deleting topic', err);
        }

        await delay(100);
        await this.createTopic(topic);
        logger.info(`created topic ${topic}`);
    }

    createTopic(topic: string): Promise < void > {
        return new Promise((resolve, reject) => {
            this.client.zk.createTopic(topic, 1, 1, {}, (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    deleteTopic(topic: string): Promise <void> {
        return new Promise((resolve, reject) => {
            this.client.zk.deleteTopics([topic], (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async close() {
        this.client.ready = false;
        this.client.closeBrokers();
        this.client.close();
        this.client.zk.close();
    }
}
