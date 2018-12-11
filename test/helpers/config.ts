import uuidv4 from 'uuid/v4';

const {
    KAFKA_BROKERS = 'localhost:9092'
} = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());

export const fetcherTopic = 'kafka-test-fetcher';
export const fetcherGroup = uuidv4();
export const senderTopic = 'kafka-test-sender';
