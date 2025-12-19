import convict from 'convict';
import { debugLogger, formats } from '@terascope/core-utils';
import connector from '../src/index.js';
import { KafkaConsumerSettings, KafkaProducerSettings } from '../src/interfaces.js';
import { kafkaBrokers } from './config.js';

const logger = debugLogger('terafoundation-kafka-connector');

function addFormats(): void {
    formats.forEach(convict.addFormat);
}

describe('Kafka Connector', () => {
    const config = {
        brokers: kafkaBrokers
    };

    addFormats();

    describe('when using a consumer', () => {
        // Not sure if should be enabled by default since depends on a kafka broker.
        it('will connect automatically by default', () => new Promise((resolve) => {
            const settings = convict(connector.config_schema()).load({
                options: {
                    type: 'consumer',
                    group: 'terascope-1',
                },
                rdkafka_options: {
                    event_cb: true,
                    debug: 'broker',
                },
            })
                .getProperties();

            // Don't know how/why `config` is used in the connecter - might be
            // legacy reasons. Without it, there is potential for connector to
            // hang/delay since `metadata.broker.list` will be undefined and:
            //
            //   Trace: BROKERFAIL [thrd:undefined:9092/bootstrap]:
            //   undefined:9092/bootstrap: failed: err: Local: Host resolution
            //   failure: (errno: Bad address)

            connector.createClient(config, logger, settings as KafkaConsumerSettings)
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
            const settings = convict(connector.config_schema()).load({
                autoconnect: false,
                options: {
                    type: 'consumer',
                    group: 'terascope-2'
                },
                rdkafka_options: {
                    'client.id': 'test-client-123'
                }
            })
                .getProperties();

            connector.createClient(config, logger, settings as KafkaConsumerSettings)
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
            const settings = convict(connector.config_schema()).load({
                options: {
                    type: 'producer',
                },
                rdkafka_options: {
                    event_cb: true,
                    debug: 'broker',
                },
            })
                .getProperties();

            // Don't know how/why `config` is used in the connecter - might be
            // legacy reasons. Without it, there is potential for connector to
            // hang/delay since `metadata.broker.list` will be undefined and:
            //
            //   Trace: BROKERFAIL [thrd:undefined:9092/bootstrap]:
            //   undefined:9092/bootstrap: failed: err: Local: Host resolution
            //   failure: (errno: Bad address)
            connector.createClient(config, logger, settings as KafkaProducerSettings)
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
            const settings = convict(connector.config_schema()).load({
                autoconnect: false,
                options: {
                    type: 'producer',
                },
                rdkafka_options: {
                    'client.id': 'test-client-123'
                }
            })
                .getProperties();

            connector.createClient(config, logger, settings as KafkaProducerSettings)
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

    describe('when using an unsupported client type', () => {
        it('should throw an error', async () => {
            const settings = convict(connector.config_schema()).load({
                options: {
                    type: 'wrong',
                },
                rdkafka_options: {
                    event_cb: true,
                    debug: 'broker',
                },
            })
                .getProperties();

            await expect(
                () => connector.createClient(config, logger, settings as any)
            ).rejects.toThrow('Unsupported client type of wrong');
        });
    });
});
