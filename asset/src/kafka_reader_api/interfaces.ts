import { APIFactoryRegistry } from '@terascope/job-components';
import { KafkaReaderConfig } from '../kafka_reader/interfaces.js';
import { APIConsumer } from '../_kafka_clients/index.js';

declare const { api_name, ...config }: KafkaReaderConfig;
export type KafkaReaderAPIConfig = typeof config

export type KafkaReaderAPI = APIFactoryRegistry<APIConsumer, KafkaReaderAPIConfig>

export const DEFAULT_API_NAME = 'kafka_reader_api';
