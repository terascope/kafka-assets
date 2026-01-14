import {
    getClientOptions,
    getConsumerOptions,
    getProducerOptions
} from '../src/helpers.js';
import {
    KafkaConnectorConfig,
    KafkaConsumerSettings,
    KafkaProducerSettings
} from '../src/interfaces.js';

describe('Kafka Helpers', () => {
    describe('getClientOptions', () => {
        const baseConfig: KafkaConnectorConfig = {
            brokers: ['localhost:9092', 'localhost:9093'],
            security_protocol: 'ssl',
            ssl_ca_location: '/path/to/ca.pem',
            ssl_certificate_location: '/path/to/cert.pem',
            ssl_key_location: '/path/to/key.pem',
            ssl_key_password: 'secret',
        };

        it('should return client options from connector config', () => {
            const result = getClientOptions(baseConfig);

            expect(result['metadata.broker.list']).toEqual(['localhost:9092', 'localhost:9093']);
            expect(result['security.protocol']).toBe('ssl');
            expect(result['ssl.ca.location']).toBe('/path/to/ca.pem');
            expect(result['ssl.certificate.location']).toBe('/path/to/cert.pem');
            expect(result['ssl.key.location']).toBe('/path/to/key.pem');
            expect(result['ssl.key.password']).toBe('secret');
        });

        it('should filter out null and empty string values', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                security_protocol: undefined,
                ssl_ca_location: '',
                ssl_certificate_location: null as any,
            };

            const result = getClientOptions(config);

            expect(result['metadata.broker.list']).toEqual(['localhost:9092']);
            expect(result['security.protocol']).toBeUndefined();
            expect(result['ssl.ca.location']).toBeUndefined();
            expect(result['ssl.certificate.location']).toBeUndefined();
        });

        it('should merge caCertificate into ssl.ca.pem', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                caCertificate: '-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----',
            };

            const result = getClientOptions(config);

            expect(result['ssl.ca.pem']).toBe('-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----');
        });

        describe('option hierarchy and override behavior', () => {
            it('should override connector config with config.rdkafka_options', () => {
                const config: KafkaConnectorConfig = {
                    brokers: ['localhost:9092'],
                    security_protocol: 'plaintext',
                    rdkafka_options: {
                        'security.protocol': 'ssl',
                        'client.id': 'test-client-from-connector'
                    }
                };

                const result = getClientOptions(config);

                // rdkafka_options should override the security_protocol
                expect(result['security.protocol']).toBe('ssl');
                expect(result['client.id']).toBe('test-client-from-connector');
            });

            it('should override config.rdkafka_options with additional passed options', () => {
                const config: KafkaConnectorConfig = {
                    brokers: ['localhost:9092'],
                    security_protocol: 'plaintext',
                    rdkafka_options: {
                        'security.protocol': 'ssl',
                        'client.id': 'test-client-from-connector'
                    }
                };

                const additionalOptions = {
                    'client.id': 'test-client-override',
                    'group.id': 'test-group'
                };

                const result = getClientOptions(config, additionalOptions);

                // Additional options should override both connector config and rdkafka_options
                expect(result['security.protocol']).toBe('ssl');
                expect(result['client.id']).toBe('test-client-override');
                expect(result['group.id']).toBe('test-group');
            });

            it('should handle complete hierarchy: base config < rdkafka_options < additional options', () => {
                const config: KafkaConnectorConfig = {
                    brokers: ['localhost:9092'],
                    security_protocol: 'plaintext',
                    ssl_ca_location: '/base/ca.pem',
                    rdkafka_options: {
                        'security.protocol': 'ssl',
                        'ssl.ca.location': '/rdkafka/ca.pem',
                        'client.id': 'rdkafka-client'
                    }
                };

                const additionalOptions = {
                    'ssl.ca.location': '/override/ca.pem',
                    'group.id': 'final-group'
                };

                const result = getClientOptions(config, additionalOptions);

                // Verify the complete hierarchy
                expect(result['metadata.broker.list']).toEqual(['localhost:9092']); // from base
                expect(result['security.protocol']).toBe('ssl'); // from rdkafka_options
                // from additional options (highest priority)
                expect(result['ssl.ca.location']).toBe('/override/ca.pem');
                expect(result['client.id']).toBe('rdkafka-client'); // from rdkafka_options
                expect(result['group.id']).toBe('final-group'); // from additional options
            });

            it('should support multiple additional option objects with proper precedence', () => {
                const config: KafkaConnectorConfig = {
                    brokers: ['localhost:9092'],
                    rdkafka_options: {
                        'client.id': 'rdkafka-client',
                        'group.id': 'rdkafka-group'
                    }
                };

                const options1 = {
                    'client.id': 'options1-client',
                    'group.id': 'options1-group',
                    'session.timeout.ms': 10000
                };

                const options2 = {
                    'group.id': 'options2-group',
                    'heartbeat.interval.ms': 3000
                };

                const result = getClientOptions(config, options1, options2);

                // Later options should override earlier ones
                expect(result['client.id']).toBe('options1-client'); // from options1
                // from options2 (overrides options1)
                expect(result['group.id']).toBe('options2-group');
                expect(result['session.timeout.ms']).toBe(10000); // from options1
                expect(result['heartbeat.interval.ms']).toBe(3000); // from options2
            });

            it('should handle null/empty values in hierarchy correctly', () => {
                const config: KafkaConnectorConfig = {
                    brokers: ['localhost:9092'],
                    security_protocol: 'ssl',
                    ssl_ca_location: '/base/ca.pem',
                    rdkafka_options: {
                        'ssl.ca.location': '' // empty string should remove the value
                    }
                };

                const result = getClientOptions(config);

                // Empty string from rdkafka_options should filter out the ssl.ca.location
                expect(result['ssl.ca.location']).toBeUndefined();
                expect(result['security.protocol']).toBe('ssl');
            });
        });
    });

    describe('getConsumerOptions', () => {
        const baseConfig: KafkaConnectorConfig = {
            brokers: ['localhost:9092'],
        };

        it('should return consumer options with group id', () => {
            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'test-consumer-group'
                }
            };

            const result = getConsumerOptions(baseConfig, settings);

            expect(result.group).toBe('test-consumer-group');
            expect(result.clientOptions['group.id']).toBe('test-consumer-group');
            expect(result.clientOptions['metadata.broker.list']).toEqual(['localhost:9092']);
        });

        it('should set default topic options', () => {
            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'test-group'
                }
            };

            const result = getConsumerOptions(baseConfig, settings);

            expect(result.topicOptions['auto.offset.reset']).toBe('smallest');
        });

        it('should merge custom topic options with defaults', () => {
            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'test-group'
                },
                topic_options: {
                    'auto.offset.reset': 'largest',
                    'auto.commit.enable': true
                }
            };

            const result = getConsumerOptions(baseConfig, settings);

            expect(result.topicOptions['auto.offset.reset']).toBe('largest');
            expect(result.topicOptions['auto.commit.enable']).toBe(true);
        });

        it('should pass rdkafka_options to client options', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                rdkafka_options: {
                    'client.id': 'connector-client'
                }
            };

            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'test-group'
                },
                rdkafka_options: {
                    'client.id': 'settings-client',
                    'enable.auto.commit': false
                }
            };

            const result = getConsumerOptions(config, settings);

            // settings.rdkafka_options should override config.rdkafka_options
            expect(result.clientOptions['client.id']).toBe('settings-client');
            expect(result.clientOptions['enable.auto.commit']).toBe(false);
        });

        it('should handle option hierarchy for consumer', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                security_protocol: 'plaintext',
                rdkafka_options: {
                    'security.protocol': 'ssl',
                    'client.id': 'config-client'
                }
            };

            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'test-group'
                },
                rdkafka_options: {
                    'client.id': 'settings-client'
                }
            };

            const result = getConsumerOptions(config, settings);

            // Check hierarchy: base < config.rdkafka_options < op params < settings.rdkafka_options
            expect(result.clientOptions['security.protocol']).toBe('ssl'); // from config.rdkafka_options
            expect(result.clientOptions['group.id']).toBe('test-group'); // from operation params
            expect(result.clientOptions['client.id']).toBe('settings-client'); // from settings.rdkafka_options (highest priority)
        });

        it('should allow settings.rdkafka_options to override operation parameters including group.id', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
            };

            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'operation-group'
                },
                rdkafka_options: {
                    'group.id': 'override-group', // This should override the operation group
                    'session.timeout.ms': 45000
                }
            };

            const result = getConsumerOptions(config, settings);

            // settings.rdkafka_options has highest priority and can override operation parameters
            expect(result.clientOptions['group.id']).toBe('override-group');
            expect(result.clientOptions['session.timeout.ms']).toBe(45000);
            // The group property should still reflect the original operation group
            expect(result.group).toBe('operation-group');
        });

        it('should demonstrate complete consumer hierarchy with all levels', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                security_protocol: 'plaintext',
                ssl_ca_location: '/base/ca.pem',
                rdkafka_options: {
                    'security.protocol': 'ssl',
                    'ssl.ca.location': '/config-rdkafka/ca.pem',
                    'fetch.min.bytes': 1024
                }
            };

            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'my-consumer-group'
                },
                rdkafka_options: {
                    'ssl.ca.location': '/settings-rdkafka/ca.pem',
                    'fetch.wait.max.ms': 500
                }
            };

            const result = getConsumerOptions(config, settings);

            // Complete hierarchy demonstration:
            // 1. Base config sets security_protocol='plaintext',
            //    ssl_ca_location='/base/ca.pem'
            // 2. config.rdkafka_options overrides to security.protocol='ssl',
            //    ssl.ca.location='/config-rdkafka/ca.pem', adds fetch.min.bytes
            // 3. Operation params set group.id='my-consumer-group'
            // 4. settings.rdkafka_options overrides
            //    ssl.ca.location='/settings-rdkafka/ca.pem',
            //    adds fetch.wait.max.ms (HIGHEST PRIORITY)
            // from base config
            expect(result.clientOptions['metadata.broker.list']).toEqual(['localhost:9092']);
            // from config.rdkafka_options
            expect(result.clientOptions['security.protocol']).toBe('ssl');
            // from settings.rdkafka_options (highest)
            expect(result.clientOptions['ssl.ca.location']).toBe('/settings-rdkafka/ca.pem');
            // from config.rdkafka_options
            expect(result.clientOptions['fetch.min.bytes']).toBe(1024);
            // from operation params
            expect(result.clientOptions['group.id']).toBe('my-consumer-group');
            // from settings.rdkafka_options
            expect(result.clientOptions['fetch.wait.max.ms']).toBe(500);
            expect(result.group).toBe('my-consumer-group');
        });
    });

    describe('getProducerOptions', () => {
        const baseConfig: KafkaConnectorConfig = {
            brokers: ['localhost:9092'],
        };
        it('should use custom poll_interval when provided', () => {
            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer',
                    poll_interval: 250
                }
            };

            const result = getProducerOptions(baseConfig, settings);

            expect(result.pollInterval).toBe(250);
        });

        it('should handle poll_interval of 0', () => {
            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer',
                    poll_interval: 0
                }
            };

            const result = getProducerOptions(baseConfig, settings);

            expect(result.pollInterval).toBe(0);
        });

        it('should merge custom topic options', () => {
            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer'
                },
                topic_options: {
                    'request.required.acks': 1,
                    'request.timeout.ms': 5000
                }
            };

            const result = getProducerOptions(baseConfig, settings);

            expect(result.topicOptions['request.required.acks']).toBe(1);
            expect(result.topicOptions['request.timeout.ms']).toBe(5000);
        });

        it('should pass rdkafka_options to client options', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                rdkafka_options: {
                    'client.id': 'connector-client'
                }
            };

            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer'
                },
                rdkafka_options: {
                    'client.id': 'settings-client',
                    'compression.codec': 'snappy'
                }
            };

            const result = getProducerOptions(config, settings);

            // settings.rdkafka_options should override config.rdkafka_options
            expect(result.clientOptions['client.id']).toBe('settings-client');
            expect(result.clientOptions['compression.codec']).toBe('snappy');
        });

        it('should handle option hierarchy for producer', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                rdkafka_options: {
                    'queue.buffering.max.messages': 100000,
                    'client.id': 'config-client'
                }
            };

            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer'
                },
                rdkafka_options: {
                    'queue.buffering.max.messages': 200000,
                    'client.id': 'settings-client'
                }
            };

            const result = getProducerOptions(config, settings);

            // Verify hierarchy:
            // producer defaults < config.rdkafka_options < settings.rdkafka_options
            // settings.rdkafka_options (highest)
            expect(result.clientOptions['queue.buffering.max.messages']).toBe(200000);
            // settings.rdkafka_options (highest)
            expect(result.clientOptions['client.id']).toBe('settings-client');
        });

        it('should allow settings.rdkafka_options to override all producer defaults', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                rdkafka_options: {
                    'batch.num.messages': 50000 // override default
                }
            };

            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer'
                },
                rdkafka_options: {
                    'queue.buffering.max.messages': 750000, // override default (500000)
                    'batch.num.messages': 25000, // override config.rdkafka_options (50000)
                    'compression.type': 'gzip'
                }
            };

            const result = getProducerOptions(config, settings);

            // settings.rdkafka_options has highest priority - can override
            // producer defaults and config.rdkafka_options
            // from settings.rdkafka_options
            expect(result.clientOptions['batch.num.messages']).toBe(25000);
            // from settings.rdkafka_options
            expect(result.clientOptions['queue.buffering.max.messages']).toBe(750000);
            // from settings.rdkafka_options
            expect(result.clientOptions['compression.type']).toBe('gzip');
        });

        it('should demonstrate complete producer hierarchy with all levels', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                security_protocol: 'plaintext',
                rdkafka_options: {
                    'security.protocol': 'ssl',
                    'batch.num.messages': 50000
                }
            };

            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer'
                },
                rdkafka_options: {
                    'batch.num.messages': 75000
                }
            };

            const result = getProducerOptions(config, settings);

            // Complete hierarchy demonstration:
            // 1. Base config sets security_protocol='plaintext'
            // 2. config.rdkafka_options overrides to security.protocol='ssl',
            //    batch.num.messages=50000
            // 3. settings.rdkafka_options overrides batch.num.messages=75000
            //    (HIGHEST PRIORITY)
            // from config.rdkafka_options
            expect(result.clientOptions['security.protocol']).toBe('ssl');
            // from settings.rdkafka_options (highest)
            expect(result.clientOptions['batch.num.messages']).toBe(75000);
        });

        it('should be able to override producer and consumer defaults from terafoundation', () => {
            const config: KafkaConnectorConfig = {
                brokers: ['localhost:9092'],
                security_protocol: 'plaintext',
                rdkafka_options: {
                    'queue.buffering.max.messages': 120000,
                    'queue.buffering.max.kbytes': 1248576,
                    'max.poll.interval.ms': 30000
                }
            };

            const pSettings: KafkaProducerSettings = {
                options: { type: 'producer' },
                rdkafka_options: {}
            };

            const cSettings: KafkaConsumerSettings = {
                options: { type: 'consumer' },
                rdkafka_options: {}
            };

            const producer = getProducerOptions(config, pSettings);
            const consumer = getProducerOptions(config, cSettings);
            expect(producer.clientOptions['queue.buffering.max.messages']).toBe(120000);
            expect(producer.clientOptions['queue.buffering.max.kbytes']).toBe(1248576);
            // This is a consumer specific setting but will still override as the
            // rdkafka_options covers all settings as globals
            expect(consumer.clientOptions['max.poll.interval.ms']).toBe(30000);
        });
    });
});
