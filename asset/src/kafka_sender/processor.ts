import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    Logger,
    APIFactoryRegistry,
} from '@terascope/job-components';
import { KafkaSenderConfig } from './interfaces';
import { KafkaSenderAPIConfig } from '../kafka_sender_api/interfaces';

import { ProduceFn } from '../_kafka_clients';
import KafkaRouteSender from '../kafka_sender_api/kafka-route-sender';

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

const DEFAULT_API_NAME = 'kafka_sender_api';

type KafkaSenderFactoryAPI = APIFactoryRegistry<KafkaRouteSender, KafkaSenderAPIConfig>

export default class KafkaSender extends BatchProcessor<KafkaSenderConfig> {
    topicMap: TopicMap = new Map();
    connectorDict: ConnectorMap = new Map();
    hasConnectionMap = false;
    kafkaLogger: Logger
    tryFn: ProduceFn;
    api!: KafkaRouteSender;

    constructor(
        context: WorkerContext,
        opConfig: KafkaSenderConfig,
        executionConfig: ExecutionConfig
    ) {
        super(context, opConfig, executionConfig);

        const logger = this.logger.child({ module: 'kafka-producer' });
        this.kafkaLogger = logger;
        this.tryFn = this.tryRecord.bind(this) as ProduceFn;
    }

    async initialize(): Promise<void> {
        await super.initialize();
        let apiName = DEFAULT_API_NAME;
        let apiTopic: string | undefined;
        let apiConnection: string | undefined;

        if (this.opConfig.api_name) {
            apiName = this.opConfig?.api_name;
            const apiConfig = this.executionConfig.apis.find((config) => config._name === apiName);
            if (apiConfig == null) throw new Error(`could not find api configuration for api ${apiName}`);
            apiTopic = apiConfig.topic;
            apiConnection = apiConfig.connection;
        }

        const factoryApi = this.getAPI<KafkaSenderFactoryAPI>(apiName);

        const topic = this.opConfig.topic || apiTopic as string;
        const connection = this.opConfig.connection || apiConnection as string;
        const api = await factoryApi.create(
            connection,
            {
                connection,
                topic,
                tryFn: this.tryFn,
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
