import { v4 as uuidv4 } from 'uuid';

const {
    KAFKA_BROKERS = '10.210.50.201:19092'
} = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());

export const fetcherTopic = 'kafka-test-fetcher';
export const fetcherGroup = uuidv4();
export const senderTopic = 'kafka-test-sender';
export const deadLetterTopic = 'kafka-dead-letter';
