import { Omit } from '@terascope/job-components';
import { KafkaReaderConfig } from '../kafka_reader/interfaces';

export type KafkaReaderAPIConfig = Omit<KafkaReaderConfig, 'api_name'>
