import { Slicer } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';

export default class KafkaSlicer extends Slicer<KafkaReaderConfig> {
    isRecoverable() {
        return Boolean(this.executionConfig.autorecover);
    }

    maxQueueLength() {
        return this.workersConnected + 1;
    }

    async slice() {
        return { };
    }
}
