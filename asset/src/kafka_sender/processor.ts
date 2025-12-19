import {
    DataEntity,
    Logger
} from '@terascope/core-utils';
import { makeExContextLogger, Context, BatchProcessor } from '@terascope/job-components';
import { ExecutionConfig } from '@terascope/types';
import { KafkaSenderConfig } from './interfaces.js';
import { KafkaSenderAPI } from '../kafka_sender_api/interfaces.js';

import KafkaRouteSender from '../kafka_sender_api/sender.js';

interface Endpoint {
    sender: KafkaRouteSender;
    data: any[];
}

interface ConnectorMapping {
    _connection: string;
    topic: string;
    _key?: string;
}

type TopicMap = Map<string, Endpoint>;
type ConnectorMap = Map<string, ConnectorMapping>;

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    topicMap: TopicMap = new Map();
    connectorDict: ConnectorMap = new Map();
    hasConnectionMap = false;
    api!: KafkaRouteSender;

    constructor(
        context: Context,
        opConfig: KafkaSenderConfig,
        executionConfig: ExecutionConfig
    ) {
        super(context, opConfig, executionConfig);
    }

    async initialize(): Promise<void> {
        await super.initialize();

        // TODO: This should be in the context but doesn't seem to work at the moment
        const kafkaLogger: Logger = makeExContextLogger(this.context, this.executionConfig, 'kafka-producer');

        if (!this.opConfig._api_name) {
            throw new Error('kafka_sender must have "_api_name" defined in the job');
        }
        const apiName = this.opConfig._api_name;
        const apiConfig = this.executionConfig.apis.find(
            (config: { _name: string }) => config._name === apiName
        );
        if (apiConfig == null) throw new Error(`could not find api configuration for api ${apiName}`);
        const apiTopic = apiConfig.topic;
        const apiConnection = apiConfig._connection;

        const factoryApi = this.getAPI<KafkaSenderAPI>(apiName);

        const topic = this.opConfig.topic || apiTopic as string;
        const connection = this.opConfig._connection || apiConnection as string;
        const api = await factoryApi.create(
            connection,
            {
                connection,
                topic,
                logger: kafkaLogger
            }
        );

        this.api = api;
    }

    async onBatch(batch: DataEntity[]): Promise<DataEntity[]> {
        await this.api.send(batch);
        return batch;
    }
}
