"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_components_1 = require("@terascope/job-components");
const node_rdkafka_1 = require("node-rdkafka");
const error_codes_1 = require("../../asset/src/_kafka_helpers/error-codes");
const _kafka_helpers_1 = require("../../asset/src/_kafka_helpers");
const config_1 = require("./config");
const logger = (0, job_components_1.debugLogger)('test-kafka-admin');
class KafkaAdmin {
    constructor() {
        this._client = node_rdkafka_1.AdminClient.create({
            'metadata.broker.list': (0, job_components_1.castArray)(config_1.kafkaBrokers).join(','),
        });
    }
    async ensureTopic(topic) {
        logger.debug(`ensuring topic "${topic}"...`);
        try {
            await this.deleteTopic(topic);
            await (0, job_components_1.pDelay)(500);
        }
        catch (err) {
            if (!(0, _kafka_helpers_1.isKafkaError)(err) || err.code !== error_codes_1.ERR_UNKNOWN_TOPIC_OR_PART) {
                throw err;
            }
        }
        await this.createTopic(topic);
        logger.debug(`ensured topic "${topic}" is new`);
    }
    createTopic(topic) {
        return new Promise((resolve, reject) => {
            this._client.createTopic({
                topic,
                num_partitions: 1,
                replication_factor: 1,
                config: {},
            }, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    deleteTopic(topic) {
        return new Promise((resolve, reject) => {
            this._client.deleteTopic(topic, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    disconnect() {
        this._client.disconnect();
    }
}
exports.default = KafkaAdmin;
//# sourceMappingURL=kafka-admin.js.map