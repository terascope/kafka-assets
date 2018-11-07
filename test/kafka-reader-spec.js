'use strict';

const reader = require('../asset/teraslice_kafka_reader');

describe('Kafka Reader', () => {
    it('should have the correct modules', () => {
        expect(reader).toHaveProperty('newReader');
        expect(reader).toHaveProperty('newSlicer');
        expect(reader).toHaveProperty('schema');
        expect(reader).toHaveProperty('crossValidation');
        expect(reader).toHaveProperty('slicerQueueLength');
    });

    it('slicerQueueLength should return QUEUE_MINIMUM_SIZE', () => {
        expect(reader.slicerQueueLength()).toEqual('QUEUE_MINIMUM_SIZE');
    });

    it('crossValidation should throw an error if json_protocol exists', () => {
        const job = {
            operations: [
                {
                    _op: 'teraslice_kafka_reader'
                },
                {
                    _op: 'json_protocol'
                }
            ]
        };

        expect(() => {
            reader.crossValidation(job);
        }).toThrowError('Kafka Reader handles serialization, please remove "json_protocol"');
    });

    it('crossValidation should not throw an error if there is no json_protocol', () => {
        const job = {
            operations: [
                {
                    _op: 'teraslice_kafka_reader'
                }
            ]
        };

        expect(() => {
            reader.crossValidation(job);
        }).not.toThrow();
    });
});
