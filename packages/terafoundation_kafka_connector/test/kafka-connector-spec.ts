
// @ts-ignore
import bunyan from '@types/bunyan';
import convict from 'convict';
import { debugLogger } from '@terascope/job-components';
import connector from '../src';

// @ts-ignore
const logger = debugLogger('terafoundation-kafka-connector') as bunyan;

describe('basics', () => {
    // Not sure if should be enabled by default since depends on a kafka broker.
    it('will connect automatically by default', (done) => {
        const settings = convict(connector.config_schema()).load({
            options: {
                type: 'consumer',
                group: 'terascope',
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
        const conn = connector.create({ brokers: 'localhost:9092' }, logger, settings);
        conn.client.on('ready', (client, metadata) => {
            logger.trace(client, metadata, 'connected');
        });
        conn.client.on('event.log', (event) => {
            logger.trace(event.fac, event.message);
        });
        const giveConnectSomeTime = new Promise((resolve) => {
            setTimeout(() => resolve(), 100);
        });
        Promise.resolve(giveConnectSomeTime)
            .then(() => {
                expect(conn.client.isConnected()).toBe(true);
                done();
            });
    });

    it('can be configured to not automatically connect', (done) => {
        const settings = convict(connector.config_schema()).load({
            autoconnect: false,
            options: {
                type: 'consumer',
            }
        }).getProperties();
        const conn = connector.create({ brokers: [] }, logger, settings);
        expect(conn.client.isConnected()).toBe(false);
        done();
    });

    // Not clear how `brokers` in schema is intended to be used.
    xit('how to specify broker?', (done) => {
        const settings = convict(connector.config_schema()).load({
            brokers: ['localhost:9093'],
            options: {
                type: 'consumer',
                group: 'terascope',
            },
            rdkafka_options: {
                event_cb: true,
                debug: 'broker,protocol',
            },
        }).getProperties();
        const conn = connector.create({ brokers: [] }, logger, settings);
        conn.client.on('ready', (client, metadata) => {
            logger.trace(client, metadata, 'connected');
        });
        conn.client.on('event.log', (event) => {
            logger.trace(event.fac, event.message);
        });
        const giveConnectSomeTime = new Promise((resolve) => {
            setTimeout(() => resolve(), 4000);
        });
        Promise.resolve(giveConnectSomeTime)
            .then(() => {
                expect(conn.client.isConnected()).toBe(false);
                done();
            });
    });
});
