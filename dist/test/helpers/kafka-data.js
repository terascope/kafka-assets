"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readData = exports.loadData = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const job_components_1 = require("@terascope/job-components");
const kafka = __importStar(require("node-rdkafka"));
const config_1 = require("./config");
const _kafka_clients_1 = require("../../asset/src/_kafka_clients");
const logger = (0, job_components_1.debugLogger)('kafka-data');
async function loadData(topic, fileName) {
    const filePath = path_1.default.join(__dirname, '..', 'fixtures', fileName);
    const exampleData = fs_1.default.readFileSync(filePath, 'utf8');
    const data = [];
    const messages = exampleData.trim()
        .split('\n')
        .map((d) => {
        try {
            data.push(JSON.parse(d));
        }
        catch (err) {
            // do nothing
        }
        return Buffer.from(d);
    });
    const producer = new kafka.Producer({
        'compression.codec': 'gzip',
        'queue.buffering.max.messages': messages.length,
        'queue.buffering.max.ms': 20,
        'batch.num.messages': messages.length,
        'topic.metadata.refresh.interval.ms': -1,
        'log.connection.close': false,
        'metadata.broker.list': (0, job_components_1.castArray)(config_1.kafkaBrokers).join(','),
    }, {});
    const client = new _kafka_clients_1.ProducerClient(producer, {
        logger,
        topic,
        bufferSize: messages.length
    });
    await client.connect();
    logger.debug(`loading ${messages.length} into topic: ${topic}...`);
    client.flushTimeout = 5000;
    await client.produce(messages, (_data) => ({
        topic,
        key: null,
        data: _data,
        timestamp: Date.now()
    }));
    logger.debug('DONE loading messages');
    client.disconnect();
    return data;
}
exports.loadData = loadData;
async function readData(topic, size) {
    const consumer = new kafka.KafkaConsumer({
        // We want to explicitly manage offset commits.
        'enable.auto.commit': false,
        'enable.auto.offset.store': false,
        'queued.min.messages': size,
        // we want to capture the rebalance so we can handle
        // them better
        rebalance_cb: true,
        'group.id': (0, uuid_1.v4)(),
        'metadata.broker.list': (0, job_components_1.castArray)(config_1.kafkaBrokers).join(','),
    }, {
        'auto.offset.reset': 'smallest'
    });
    const client = new _kafka_clients_1.ConsumerClient(consumer, {
        logger,
        topic,
    });
    await client.connect();
    const messages = await client.consume((msg) => {
        try {
            return JSON.parse(msg.value.toString('utf8'));
        }
        catch (err) {
            if (Buffer.isBuffer(msg.value)) {
                return msg.value.toString('utf8');
            }
            return msg.value;
        }
    }, {
        size,
        wait: 10000
    });
    await client.commit();
    client.disconnect();
    return messages;
}
exports.readData = readData;
//# sourceMappingURL=kafka-data.js.map