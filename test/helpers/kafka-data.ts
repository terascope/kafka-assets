import fs from 'fs';
import path from 'path';
import { debugLogger } from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { ProducerClient } from '../../asset/src/_kafka_clients';

export async function loadData(topic: string, fileName: string): Promise<object[]> {
    const logger = debugLogger('load-test-data');

    const filePath = path.join(__dirname, '..', 'fixtures', fileName);
    const exampleData = fs.readFileSync(filePath, 'utf8');

    const data: object[] = [];

    const messages = exampleData.trim()
        .split('\n')
        .map((d) => {
            try {
                data.push(JSON.parse(d));
            } catch (err) {}
            return Buffer.from(d);
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
    });

    await client.connect();

    logger.debug(`loading ${messages.length} into topic: ${topic}...`);

    await client.produce(messages, (data) => {
        return {
            topic,
            key: null,
            data,
            timestamp: Date.now()
        };
    }, 5000);

    logger.debug('DONE loading messages');

    await client.disconnect();

    return data;
}
