const {
    KAFKA_HOSTNAME = 'localhost',
    KAFKA_PORT = '49092',
    KAFKA_BROKERS = `${KAFKA_HOSTNAME}:${KAFKA_PORT}`
} = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());
