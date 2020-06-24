import { Omit } from '@terascope/job-components';
import { KafkaSenderConfig } from '../kafka_sender/interfaces';

export type KafkaSenderAPIConfig = Omit<KafkaSenderConfig, 'api_name'>
