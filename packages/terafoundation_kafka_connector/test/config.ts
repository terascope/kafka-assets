const { KAFKA_BROKERS = 'localhost:9092' } = process.env;

export const kafkaBrokers: string[] = KAFKA_BROKERS.split(',').map((s) => s.trim());
