import uuidv4 from 'uuid/v4';

const {
    KAFKA_BROKERS = 'localhost:9092',
    FIXED_KAFKA_TOPICS = 'false'
} = process.env;

const fixedTopics = FIXED_KAFKA_TOPICS === 'true';

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());

export const fetcherTopic = fixedTopics ? 'kafka-test-fetcher' : `kafka-test-fetcher-${uuidv4()}`;
export const fetcherGroup = uuidv4();
export const senderTopic = fixedTopics ? 'kafka-test-sender' : `kafka-test-sender-${uuidv4()}`;
