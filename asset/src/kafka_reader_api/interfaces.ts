import { APIFactoryRegistry } from '@terascope/job-components';
import { KafkaReaderConfig } from '../kafka_reader/interfaces.js';
import { APIConsumer } from '../_kafka_clients/index.js';

declare const { api_name, ..._config }: KafkaReaderConfig;
export type KafkaReaderAPIConfig = typeof _config;

export type KafkaReaderAPI = APIFactoryRegistry<APIConsumer, KafkaReaderAPIConfig>;
