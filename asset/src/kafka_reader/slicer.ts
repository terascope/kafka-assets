import { Slicer } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';

export default class KafkaSlicer extends Slicer<KafkaReaderConfig> {
    maxQueueLength() {
        return this.workersConnected * 2;
    }

    async slice() {
        return { };
    }
}