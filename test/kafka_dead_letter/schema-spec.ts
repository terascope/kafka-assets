import 'jest-extended';
import { TestContext } from '@terascope/job-components';
import Schema from '../../asset/src/kafka_dead_letter/schema';

describe('Kafka Dead Letter Schema', () => {
    const context = new TestContext('kafka-sender');
    const schema = new Schema(context, 'api');

    afterAll(() => {
        context.apis.foundation.getSystemEvents().removeAllListeners();
    });

    describe('when validating the schema', () => {
        it('should throw an error if no topic is specified', () => {
            expect(() => {
                schema.validate({
                    _name: 'kafka_deader_letter'
                });
            }).toThrow(/kafka_deader_letter - topic: This field is required and must by of type string/);
        });

        it('should not throw an error if valid config is given', () => {
            expect(() => {
                schema.validate({
                    _name: 'kafka_deader_letter',
                    topic: 'hello'
                });
            }).not.toThrow();
        });
    });
});
