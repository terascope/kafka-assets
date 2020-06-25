import {
    DataEntity,
    BatchProcessor,
    WorkerContext,
    ExecutionConfig,
    TSError,
    Logger,
    APIFactoryRegistry,
    isNil
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
    senderApi!: KafkaSenderFactoryAPI;

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

        const api = this.getAPI<KafkaSenderFactoryAPI>(apiName);
        this.senderApi = api;
        // this might be undefined, but will throw in the create call if it does not exist
        const topic = this.opConfig.topic || apiTopic as string;
        const connection = this.opConfig.connection || apiConnection as string;
        const { connection_map: connectionMap } = this.opConfig;

        if (connectionMap) {
            this.hasConnectionMap = true;
            const keysets = Object.keys(connectionMap);

            if (keysets.includes('*') && keysets.includes('**')) throw new TSError('connectorMap cannot specify "*" and "**"');

            for (const keyset of keysets) {
                const keys = keyset.split(',');

                for (const key of keys) {
                    const topicSettings: ConnectorMapping = {
                        connection: connectionMap[keyset],
                        topic,
                        _key: key
                    };
                    this.connectorDict.set(key, topicSettings);
                }
            }
        // the connection specified on opConfig must be on topicMap
        } else {
            // a topic without a connectionMap is semantically the same as a * with a connectionMap
            this.connectorDict.set('*', { connection, topic, _key: '*' });
        }
    }

    private async createTopic(route: string) {
        const config = this.connectorDict.get(route) as ConnectorMapping;
        let sender = this.senderApi.get(config.connection);

        if (isNil(sender)) {
            const { opConfig } = this;
            sender = await this.senderApi.create(
                config.topic,
                {
                    ...opConfig,
                    ...config,
                    tryFn: this.tryFn,
                    logger: this.kafkaLogger
                }
            );
        }

        this.topicMap.set(route, { sender, data: [] });
    }

    private _cleanupTopicMap() {
        for (const config of this.topicMap.values()) {
            config.data = [];
        }
    }

    async routeToAllTopics(batch: DataEntity[]): Promise<void> {
        const senders = [];

        for (const record of batch) {
            const route = record.getMetadata('standard:route');
            // if we have route, then use it, else make a topic if allowed.
            // if not then check if a "*" is set, if not then use rejectRecord
            if (this.topicMap.has(route)) {
                const routeConfig = this.topicMap.get(route) as Endpoint;
                routeConfig.data.push(record);
            } else if (this.connectorDict.has(route)) {
                await this.createTopic(route);

                const routeConfig = this.topicMap.get(route) as Endpoint;
                routeConfig.data.push(record);
            } else if (this.connectorDict.has('*')) {
                if (!this.topicMap.has('*')) {
                    await this.createTopic('*');
                }

                const routeConfig = this.topicMap.get('*') as Endpoint;
                routeConfig.data.push(record);
            } else if (this.connectorDict.has('**')) {
                if (!this.topicMap.has('**')) {
                    await this.createTopic('**');
                }
                const routeConfig = this.topicMap.get('**') as Endpoint;

                await routeConfig.sender.verify(route);

                routeConfig.data.push(record);
            } else {
                let error: TSError;

                if (route == null) {
                    error = new TSError('No route was specified in record metadata');
                } else {
                    error = new TSError(`Invalid connection route: ${route} was not found on connector_map`);
                }

                this.rejectRecord(record, error);
            }
        }

        for (const [, { data, sender }] of this.topicMap) {
            if (data.length > 0) {
                senders.push(sender.send(data));
            }
        }

        await Promise.all(senders);

        this._cleanupTopicMap();
    }

    async onBatch(batch: DataEntity[]): Promise<DataEntity[]> {
        await this.routeToAllTopics(batch);
        return batch;
    }
}
