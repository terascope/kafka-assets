import fs from 'fs';
import path from 'path';
import uuidv4 from 'uuid/v4';
import { kafkaBrokers } from './config';
import { debugLogger } from '@terascope/job-components';
import * as kafka from 'node-rdkafka';
import { ProducerClient, ConsumerClient } from '../../asset/src/_kafka_clients';

const logger = debugLogger('kafka-data');

export async function loadData(topic: string, fileName: string): Promise<object[]> {
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
        'queue.buffering.max.messages': messages.length * 5,
        'queue.buffering.max.ms': 20,
        'batch.num.messages': messages.length,
        'topic.metadata.refresh.interval.ms': -1,
        'log.connection.close': false,
        'metadata.broker.list': kafkaBrokers,
    }, {});

    const client = new ProducerClient(producer, {
        logger,
        topic,
        bufferSize: messages.length * 5
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

    client.disconnect();

    return data;
}

export async function readData(topic: string, size: number): Promise<object[]> {
    const consumer = new kafka.KafkaConsumer({
        // We want to explicitly manage offset commits.
        'enable.auto.commit': false,
        'enable.auto.offset.store': false,
        'queued.min.messages': size,
        // we want to capture the rebalance so we can handle
        // them better
        rebalance_cb: true,
        'group.id': uuidv4(),
        'metadata.broker.list': kafkaBrokers,
    }, {
        'auto.offset.reset': 'smallest'
    });

    const client = new ConsumerClient(consumer, {
        logger,
        topic,
        bad_record_action: 'throw'
    });

    await client.connect();

    const messages = await client.consume((msg): object => {
        return JSON.parse(msg.value.toString('utf8'));
    }, {
        size,
        wait: 10000
    });

    await client.commit();

    client.disconnect();

    return messages;
}
