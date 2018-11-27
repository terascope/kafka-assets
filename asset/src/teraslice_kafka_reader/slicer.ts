import { Slicer } from '@terascope/job-components';
import { KafkaReaderConfig } from './interfaces';

export default class KafkaSlicer extends Slicer<KafkaReaderConfig> {
    async slice() {
        return null;
    }
}
