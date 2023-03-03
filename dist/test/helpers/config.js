"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetcherAPITopic = exports.deadLetterTopic = exports.senderTopic = exports.fetcherGroup = exports.fetcherTopic = exports.kafkaBrokers = void 0;
const uuid_1 = require("uuid");
const { KAFKA_BROKERS = 'localhost:9092' } = process.env;
exports.kafkaBrokers = KAFKA_BROKERS.split(',').map((s) => s.trim());
exports.fetcherTopic = 'kafka-test-fetcher';
exports.fetcherGroup = (0, uuid_1.v4)();
exports.senderTopic = 'kafka-test-sender';
exports.deadLetterTopic = 'kafka-dead-letter';
exports.fetcherAPITopic = 'kafka-api-fetcher';
//# sourceMappingURL=config.js.map