import { v4 as uuidv4 } from 'uuid';

const {
    KAFKA_HOSTNAME = 'localhost',
    KAFKA_PORT = '49092',
    KAFKA_BROKERS = `${KAFKA_HOSTNAME}:${KAFKA_PORT}`
} = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());

export const fetcherTopic = 'kafka-test-fetcher';
export const fetcherGroup = uuidv4();
export const senderTopic = 'kafka-test-sender';
export const deadLetterTopic = 'kafka-dead-letter';
export const fetcherAPITopic = 'kafka-api-fetcher';
