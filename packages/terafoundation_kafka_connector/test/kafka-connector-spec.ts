
// @ts-ignore
import convict from 'convict';
import { debugLogger } from '@terascope/job-components';
import connector from '../src';
import { KafkaConsumerSettings } from '../src/interfaces';

const logger = debugLogger('terafoundation-kafka-connector');

jest.setTimeout(5000);

describe('Kafka Connector', () => {
    const config = { brokers: ['localhost:9092'] };

    // Not sure if should be enabled by default since depends on a kafka broker.
    it('will connect automatically by default', (done) => {
        const settings = convict(connector.config_schema()).load({
            options: {
                type: 'consumer',
                group: 'terascope-1',
            },
            rdkafka_options: {
                event_cb: true,
                debug: 'broker',
            },
        }).getProperties();

        // Don't know how/why `config` is used in the connecter - might be
        // legacy reasons. Without it, there is potential for connector to
        // hang/delay since `metadata.broker.list` will be undefined and:
        //
        //   Trace: BROKERFAIL [thrd:undefined:9092/bootstrap]:
        //   undefined:9092/bootstrap: failed: err: Local: Host resolution
        //   failure: (errno: Bad address)
        const conn = connector.create(config, logger, settings as KafkaConsumerSettings);

        conn.client.once('ready', (client) => {
            logger.trace(client, 'connected');
            expect(conn.client.isConnected()).toBe(true);
            conn.client.disconnect(() => {
                done();
            });
        });
    });

    it('can be configured to not automatically connect', (done) => {
        const settings = convict(connector.config_schema()).load({
            autoconnect: false,
            options: {
                type: 'consumer',
                group: 'terascope-2'
            },
            rdkafka_options: {
                'client.id': 'test-client-123'
            }
        }).getProperties();

        const conn = connector.create(config, logger, settings as KafkaConsumerSettings);

        expect(conn.client.isConnected()).toBe(false);

        conn.client.connect({}, (err) => {
            if (err) {
                done(err);
                return;
            }

            expect(conn.client.isConnected()).toBe(true);
            conn.client.disconnect(() => {
                done();
            });
        });
    });
});
