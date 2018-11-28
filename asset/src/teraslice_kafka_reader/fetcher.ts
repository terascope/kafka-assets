import { KafkaReaderConfig } from './interfaces';
import {
    Fetcher,
    SliceRequest,
    WorkerContext,
    ExecutionConfig
} from '@terascope/job-components';
import Consumer from './consumer';

export default class KafkaReader extends Fetcher<KafkaReaderConfig> {
    private consumer: Consumer;

    constructor(context: WorkerContext, opConfig: KafkaReaderConfig, executionConfig: ExecutionConfig) {
        super(context, opConfig, executionConfig);

        this.consumer = new Consumer(context, opConfig);
    }

    async initialize() {
        await super.initialize();
        await this.consumer.connect();
        this.logger.info('Connected to Kafka');
    }

    async shutdown() {
        await this.consumer.disconnect();
        await super.shutdown();
    }

    async fetch(request: SliceRequest) {
        return [request];
    }
}
