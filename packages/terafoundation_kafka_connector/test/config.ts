import path from 'node:path';

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
