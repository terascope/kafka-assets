'use strict';

const Promise = require('bluebird');

function newProcessor(context, opConfig) {
    const bufferSize = 5 * opConfig.size;
    const logger = context.apis.foundation.makeLogger({ module: 'kafka_sender' });

    // Note that on startup, if this does not connect in time no workers will connect to the
    // execution_controller thus will shutdown the exectuion according timeout set there
    function initialize() {
        return new Promise((resolve, reject) => {
            const producer = context.foundation.getConnection({
                type: 'kafka',
                endpoint: opConfig.connection,
                options: {
                    type: 'producer'
                },
                rdkafka_options: {
                    'compression.codec': opConfig.compression,
                    'queue.buffering.max.messages': bufferSize,
                    'queue.buffering.max.ms': opConfig.wait,
                    'batch.num.messages': opConfig.size,
                    'topic.metadata.refresh.interval.ms': opConfig.metadata_refresh,
                    'log.connection.close': false
                },
                autoconnect: false
            }).client;

            const warning = setInterval(() => {
                logger.warn(`Attempting to connect to kafka endpoint ${opConfig.connection}`);
            }, 5000);

            producer.connect((err) => {
                if (err) {
                    context.logger.error('could not initialize kafka client', err);
                    reject(err);
                }
            });

            producer.on('ready', () => {
                clearInterval(warning);
                resolve(producer);
            });
        });
    }

    function makeProcessor(producer) {
        return data => new Promise(((resolve, reject) => {
            function error(err) {
                reject(err);
            }

            function batch(start) {
                let end = start + bufferSize;
                if (end > data.length) end = data.length;

                if (end === 0) {
                    resolve(data);
                    return;
                }

                for (let i = start; i < end; i += 1) {
                    const record = data[i];

                    let key = null;
                    let timestamp = null;

                    if (opConfig.id_field) {
                        // TODO: make sure the field really exists
                        key = record[opConfig.id_field];
                    }

                    if (opConfig.timestamp_field) {
                        // TODO: make sure the field really contains a date
                        timestamp = new Date(record[opConfig.timestamp_field]).getTime();
                    } else if (opConfig.timestamp_now) {
                        timestamp = Date.now();
                    }

                    producer.produce(
                        opConfig.topic,
                        // This is the partition. There may be use cases where
                        // we'll need to control this.
                        null,
                        Buffer.from(JSON.stringify(record)),
                        key,
                        timestamp
                    );
                }

                // TODO: this flush timeout may need to be configurable
                producer.flush(60000, (err) => {
                    // Remove the error listener so they don't accrue across slices.
                    producer.removeListener('event.error', error);
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (end === data.length) {
                        resolve(data);
                        return;
                    }

                    batch(end);
                });
            }

            producer.on('event.error', error);

            batch(0);
        }));
    }

    return Promise.resolve()
        .then(() => initialize())
        .then(makeProcessor)
        .catch(err => Promise.reject(`Could not initialize kafka sender error: ${err.stack}`));
}


function schema() {
    return {
        topic: {
            doc: 'Name of the Kafka topic to send data to',
            default: '',
            format: 'required_String'
        },
        id_field: {
            doc: 'Field in the incoming record that contains keys',
            default: '',
            format: String
        },
        timestamp_field: {
            doc: 'Field in the incoming record that contains a timestamp to set on the record',
            default: '',
            format: String
        },
        timestamp_now: {
            doc: 'Set to true to have a timestamp generated as records are added to the topic',
            default: '',
            format: String
        },
        connection: {
            doc: 'The Kafka producer connection to use.',
            default: 'default',
            format: String
        },
        compression: {
            doc: 'Type of compression to use',
            default: 'gzip',
            format: ['none', 'gzip', 'snappy', 'lz4']
        },
        wait: {
            doc: 'How long to wait for `size` messages to become available on the producer.',
            default: 20,
            format: Number
        },
        size: {
            doc: 'How many messages will be batched and sent to kafka together.',
            default: 10000,
            format: Number
        },
        metadata_refresh: {
            doc: 'How often the producer will poll the broker for metadata information. Set to -1 to disable polling.',
            default: 300000,
            format: Number
        }
    };
}

module.exports = {
    newProcessor,
    schema
};
