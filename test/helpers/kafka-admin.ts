import uuidv4 from 'uuid/v4';
import { promisify } from 'util';
// @ts-ignore
import { kafka } from 'kafka-tools';

const delay = promisify(setTimeout);

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
        } catch (err) {
        }

        await delay(500);
        await this.createTopic(topic);
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
