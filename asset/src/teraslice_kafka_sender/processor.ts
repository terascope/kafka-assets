import { DataEntity, BatchProcessor } from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    async onBatch(data: DataEntity[]) {
        return data;
    }
}
