import { Omit } from '@terascope/job-components';
import { KafkaReaderConfig } from '../kafka_reader/interfaces';

export type KafkaAPIConfig = Omit<KafkaReaderConfig, 'api_name'>
