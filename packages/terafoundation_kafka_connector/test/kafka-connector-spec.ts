import { debugLogger } from '@terascope/core-utils';
import connector from '../src/index.js';
import {
    KafkaConnectorConfig, KafkaConsumerSettings, KafkaProducerSettings,
    KafkaAdminSettings, connectorConfig
} from '../src/index.js';

const logger = debugLogger('terafoundation-kafka-connector');

describe('Kafka Connector', () => {
    const config: KafkaConnectorConfig = connectorConfig;

    describe('when using a consumer', () => {
        // Not sure if should be enabled by default since depends on a kafka broker.
        it('will connect automatically by default', () => new Promise((resolve) => {
            const settings: KafkaConsumerSettings = {
                options: {
                    type: 'consumer',
                    group: 'terascope-1',
                },
                rdkafka_options: {
                    event_cb: true,
                    debug: 'broker',
                },
            };

            connector.createClient(config, logger, settings)
                .then((conn) => {
                    conn.client.once('ready', (client) => {
                        logger.trace(client, 'connected');
                        expect(conn.client.isConnected()).toBe(true);
                        conn.client.disconnect(() => {
                            resolve(true);
                        });
                    });
                });
        }));

        it('can be configured to not automatically connect', () => new Promise((resolve, reject) => {
            const settings: KafkaConsumerSettings = {
                autoconnect: false,
                options: {
                    type: 'consumer',
                    group: 'terascope-2'
                },
                rdkafka_options: {
                    'client.id': 'test-client-123'
                }
            };

            connector.createClient(config, logger, settings)
                .then((conn) => {
                    expect(conn.client.isConnected()).toBe(false);

                    conn.client.connect({}, (err: any) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        expect(conn.client.isConnected()).toBe(true);
                        conn.client.disconnect(() => {
                            resolve(true);
                        });
                    });
                });
        }));
    });

    describe('when using a producer', () => {
        // Not sure if should be enabled by default since depends on a kafka broker.
        it('will connect automatically by default', () => new Promise((resolve) => {
            const settings: KafkaProducerSettings = {
                options: {
                    type: 'producer',
                },
                rdkafka_options: {
                    event_cb: true,
                    debug: 'broker',
                },
            };

            connector.createClient(config, logger, settings)
                .then((conn) => {
                    conn.client.once('ready', (client) => {
                        logger.trace(client, 'connected');
                        expect(conn.client.isConnected()).toBe(true);
                        conn.client.disconnect(() => {
                            resolve(true);
                        });
                    });
                });
        }));

        it('can be configured to not automatically connect', () => new Promise((resolve, reject) => {
            const settings: KafkaProducerSettings = {
                autoconnect: false,
                options: {
                    type: 'producer',
                },
                rdkafka_options: {
                    'client.id': 'test-client-123'
                }
            };

            connector.createClient(config, logger, settings)
                .then((conn) => {
                    expect(conn.client.isConnected()).toBe(false);

                    conn.client.connect({}, (err: any) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        expect(conn.client.isConnected()).toBe(true);
                        conn.client.disconnect(() => {
                            resolve(true);
                        });
                    });
                });
        }));
    });

    describe('when using an admin client', () => {
        it('can create an admin client', async () => {
            const settings: KafkaAdminSettings = {
                options: {
                    type: 'admin',
                },
                rdkafka_options: {
                    'client.id': 'test-admin-client'
                }
            };

            const conn = await connector.createClient(config, logger, settings);

            expect(conn.client).toBeDefined();
            expect(conn.logger).toBe(logger);

            conn.client.disconnect();
        });
    });

    describe('when using an unsupported client type', () => {
        it('should throw an error', async () => {
            const settings = {
                options: {
                    type: 'wrong',
                },
                rdkafka_options: {
                    event_cb: true,
                    debug: 'broker',
                },
            };

            await expect(
                () => connector.createClient(config, logger, settings)
            ).rejects.toThrow('Unsupported client type of wrong');
        });
    });
});
