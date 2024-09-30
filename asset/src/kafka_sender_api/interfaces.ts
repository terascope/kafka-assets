import { Omit, APIFactoryRegistry } from '@terascope/job-components';
import { KafkaSenderConfig } from '../kafka_sender/interfaces.js';
import KafkaRouteSender from '../kafka_sender_api/sender.js';

export type KafkaSenderAPIConfig = Omit<KafkaSenderConfig, 'api_name'>;

export type KafkaSenderAPI = APIFactoryRegistry<KafkaRouteSender, KafkaSenderConfig>;

export const DEFAULT_API_NAME = 'kafka_sender_api';
