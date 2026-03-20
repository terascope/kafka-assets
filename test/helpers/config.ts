import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const {
    KAFKA_HOSTNAME = 'localhost',
    KAFKA_PORT = '49094',
    KAFKA_BROKER,
    KAFKA_BROKERS = KAFKA_BROKER ?? `${KAFKA_HOSTNAME}:${KAFKA_PORT}`,
    ENCRYPT_KAFKA,
    CERT_PATH = '',
} = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());
export const encryptKafka = ENCRYPT_KAFKA === 'true';

export const connectorConfig = {
    brokers: kafkaBrokers,
    ...(encryptKafka
        ? {
            security_protocol: 'ssl' as const,
            ssl_ca_location: path.join(CERT_PATH, 'CAs/rootCA.pem'),
            ssl_certificate_location: path.join(CERT_PATH, 'kafka-keypair.pem'),
            ssl_key_location: path.join(CERT_PATH, 'kafka-keypair.pem'),
        }
        : {})
};

export const sslRdkafkaOptions = encryptKafka
    ? {
        'security.protocol': 'ssl' as const,
        'ssl.ca.location': path.join(CERT_PATH, 'CAs/rootCA.pem'),
        'ssl.certificate.location': path.join(CERT_PATH, 'kafka-keypair.pem'),
        'ssl.key.location': path.join(CERT_PATH, 'kafka-keypair.pem'),
    }
    : {};

export const fetcherTopic = 'kafka-test-fetcher';
export const fetcherGroup = uuidv4();
export const senderTopic = 'kafka-test-sender';
export const deadLetterTopic = 'kafka-dead-letter';
export const fetcherAPITopic = 'kafka-api-fetcher';
export const kafkaPort = KAFKA_PORT;
