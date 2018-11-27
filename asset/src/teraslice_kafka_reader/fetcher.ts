import { KafkaReaderConfig } from './interfaces';
import { KafkaClient } from '../helpers/interfaces';
import { Fetcher, SliceRequest } from '@terascope/job-components';

export default class KafkaReader extends Fetcher<KafkaReaderConfig> {
    client: KafkaClient;

    // @ts-ignore
    constructor(...args) {
        // @ts-ignore
        super(...args);

        this.client = this.context.apis.op_runner.getClient({}, 'kafka');
    }

    async fetch(request: SliceRequest) {
        return [request];
    }
}
