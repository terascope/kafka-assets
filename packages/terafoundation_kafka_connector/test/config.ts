const {
    KAFKA_HOSTNAME = 'localhost',
    KAFKA_PORT = '49094',
    KAFKA_BROKERS = `${KAFKA_HOSTNAME}:${KAFKA_PORT}`
} = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());
