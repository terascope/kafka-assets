import KafkaDeadLetter from '../src/kafka_dead_letter/api';
import KafkaDeadLetterSchema from '../src/kafka_dead_letter/schema';

import KafkaFetcher from '../src/kafka_reader/fetcher';
import KafkaReaderSchema from '../src/kafka_reader/schema';
import KafkaSlicer from '../src/kafka_reader/slicer';

import KafkaReaderApi from '../src/kafka_reader_api/api';
import KafkaReaderAPISchema from '../src/kafka_reader_api/schema';

import KafkaSender from '../src/kafka_sender/processor';
import KafkaSenderSchema from '../src/kafka_sender/schema';

import KafkaSenderApi from '../src/kafka_sender_api/api';
import KafkaSenderApiSchema from '../src/kafka_sender_api/schema';
import KafkaSenderApiSender from '../src/kafka_sender_api/sender';

export const ASSETS = {
    kafka_dead_letter: {
        API: KafkaDeadLetter,
        Schema: KafkaDeadLetterSchema
    },
    kafka_reader: {
        Fetcher: KafkaFetcher,
        Schema: KafkaReaderSchema,
        Slicer: KafkaSlicer
    },
    kafka_reader_api: {
        API: KafkaReaderApi,
        Schema: KafkaReaderAPISchema
    },
    kafka_sender: {
        Processor: KafkaSender,
        Schema: KafkaSenderSchema
    },
    kafka_sender_api: {
        API: KafkaSenderApi,
        Schema: KafkaSenderApiSchema,
        Processor: KafkaSenderApiSender
    }
};
