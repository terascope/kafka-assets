"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
const job_components_1 = require("@terascope/job-components");
const schema_1 = __importDefault(require("../../asset/src/kafka_dead_letter/schema"));
describe('Kafka Dead Letter Schema', () => {
    const context = new job_components_1.TestContext('kafka-sender');
    const schema = new schema_1.default(context, 'api');
    afterAll(() => {
        context.apis.foundation.getSystemEvents().removeAllListeners();
    });
    describe('when validating the schema', () => {
        it('should throw an error if no topic is specified', () => {
            expect(() => {
                schema.validate({
                    _name: 'kafka_deader_letter'
                });
            }).toThrowError(/kafka_deader_letter - topic: This field is required and must by of type string/);
        });
        it('should not throw an error if valid config is given', () => {
            expect(() => {
                schema.validate({
                    _name: 'kafka_deader_letter',
                    topic: 'hello'
                });
            }).not.toThrowError();
        });
    });
});
//# sourceMappingURL=schema-spec.js.map