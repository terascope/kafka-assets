import { Omit, APIFactoryRegistry } from '@terascope/job-components';
import { KafkaReaderConfig } from '../kafka_reader/interfaces';
import { APIConsumer } from '../_kafka_clients';

export type KafkaReaderAPIConfig = Omit<KafkaReaderConfig, 'api_name'>

export type KafkaReaderAPI = APIFactoryRegistry<APIConsumer, KafkaReaderAPIConfig>

export const DEFAULT_API_NAME = 'kafka_reader_api';
