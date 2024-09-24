import { Slicer } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces.js';

export default class KafkaSlicer extends Slicer<KafkaReaderConfig> {
    isRecoverable(): boolean {
        return Boolean(this.executionConfig.autorecover);
    }

    isRelocatable(): boolean {
        return true;
    }

    maxQueueLength(): number {
        return this.workersConnected + 1;
    }

    async slice(): Promise<Record<any, unknown>> {
        return { };
    }
}
