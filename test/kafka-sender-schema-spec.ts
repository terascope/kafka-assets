import 'jest-extended';
import { TestContext } from '@terascope/job-components';
import Schema from '../asset/src/kafka_sender/schema';

describe('Kafka Sender Schema', () => {
    const context = new TestContext('kafka-sender');
    const schema = new Schema(context);

    afterAll(() => {
        context.apis.foundation.getSystemEvents().removeAllListeners();
    });

    describe('when validating the schema', () => {
        it('should throw an error if no topic is specified', () => {
            expect(() => {
                schema.validate({
                    _op: 'kafka_sender'
                });
            }).toThrowError(/kafka_sender - topic: This field is required and must by of type string/);
        });

        it('should not throw an error if valid config is given', () => {
            expect(() => {
                schema.validate({
                    _op: 'kafka_sender',
                    topic: 'hello'
                });
            }).not.toThrowError();
        });
    });
});
