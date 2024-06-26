import {
    DataEntity,
    BatchProcessor,
    Context,
    Logger,
} from '@terascope/job-components';
import { ExecutionConfig } from '@terascope/types';
import { KafkaSenderConfig } from './interfaces.js';
import { KafkaSenderAPI, DEFAULT_API_NAME } from '../kafka_sender_api/interfaces.js';

import KafkaRouteSender from '../kafka_sender_api/sender.js';

interface Endpoint {
    sender: KafkaRouteSender;
    data: any[];
}

interface ConnectorMapping {
    connection: string;
    topic: string;
    _key?: string
}

type TopicMap = Map<string, Endpoint>
type ConnectorMap = Map<string, ConnectorMapping>

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    topicMap: TopicMap = new Map();
    connectorDict: ConnectorMap = new Map();
    hasConnectionMap = false;
    kafkaLogger: Logger;
    api!: KafkaRouteSender;

    constructor(
        context: Context,
        opConfig: KafkaSenderConfig,
        executionConfig: ExecutionConfig
    ) {
        super(context, opConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });
        this.kafkaLogger = logger;
    }

    async initialize(): Promise<void> {
        await super.initialize();
        let apiName = DEFAULT_API_NAME;
        let apiTopic: string | undefined;
        let apiConnection: string | undefined;

        if (this.opConfig.api_name) {
            apiName = this.opConfig?.api_name;
            const apiConfig = this.executionConfig.apis.find(
                (config: { _name: string; }) => config._name === apiName
            );
            if (apiConfig == null) throw new Error(`could not find api configuration for api ${apiName}`);
            apiTopic = apiConfig.topic;
            apiConnection = apiConfig.connection;
        }

        const factoryApi = this.getAPI<KafkaSenderAPI>(apiName);

        const topic = this.opConfig.topic || apiTopic as string;
        const connection = this.opConfig.connection || apiConnection as string;
        const api = await factoryApi.create(
            connection,
            {
                connection,
                topic,
                logger: this.kafkaLogger
            }
        );

        this.api = api;
    }

    async onBatch(batch: DataEntity[]): Promise<DataEntity[]> {
        await this.api.send(batch);
        return batch;
    }
}
