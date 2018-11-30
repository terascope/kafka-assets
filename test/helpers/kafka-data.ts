import fs from 'fs';
import path from 'path';
import { debugLogger, DataEncoding } from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import ProducerClient from '../../asset/src/teraslice_kafka_sender/producer-client';
import { ProduceMessage } from '../../asset/src/teraslice_kafka_sender/interfaces';

export async function loadData(topic: string, fileName: string): Promise<object[]> {

    const logger = debugLogger('load-test-data');

    const filePath = path.join(__dirname, '..', 'fixtures', fileName);
    const exampleData = fs.readFileSync(filePath, 'utf8');

    const data: object[] = [];

    const messages: ProduceMessage[] = exampleData.trim()
        .split('\n')
        .map((d) => {
            try {
                data.push(JSON.parse(d));
            } catch (err) {}
            const message: ProduceMessage = {
                topic,
                key: null,
                data: Buffer.from(d),
                timestamp: Date.now()
            };
            return message;
        });

    const producer = new kafka.Producer({
        'compression.codec': 'gzip',
        'queue.buffering.max.messages': messages.length,
        'queue.buffering.max.ms': 100,
        'batch.num.messages': messages.length,
        'topic.metadata.refresh.interval.ms': -1,
        'log.connection.close': false,
        'metadata.broker.list': ['localhost:9092'],
    }, {});

    const client = new ProducerClient(producer, {
        logger,
        topic,
        encoding: { },
    });

    await client.connect();

    logger.debug(`loading ${messages.length} into topic: ${topic}...`);

    await client.produce(messages, 5000);

    logger.debug('DONE loading messages');

    await client.disconnect();

    return data;
}
