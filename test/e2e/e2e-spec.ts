import { jest } from '@jest/globals';
import 'jest-extended';
import fs from 'node:fs';
import { TerasliceClient, Job } from 'teraslice-client-js';
import { v4 as uuidv4 } from 'uuid';
import { loadData, readData } from '../helpers/kafka-data.js';
import KafkaAdmin from '../helpers/kafka-admin.js';
import config from './config.js';

describe('Kafka Assets e2e', () => {
    jest.setTimeout(120 * 1000);

    let client: TerasliceClient;

    beforeAll(async () => {
        client = new TerasliceClient({ host: config.TERASLICE_HOST });
    });

    describe('asset upload', () => {
        it('should upload the asset bundle', async () => {
            const result = await client.assets.upload(
                fs.createReadStream(config.ASSET_ZIP_PATH)
            );

            expect(result.asset_id).toBeDefined();
        });

        it('should be discoverable on the cluster after upload', async () => {
            const records = await client.assets.getAsset('kafka');

            expect(records).not.toBeEmpty();
            expect(records[0].name).toBe('kafka');
        });
    });

    describe('kafka_reader → kafka_sender', () => {
        const inputTopic = `e2e-kafka-input-${uuidv4()}`;
        const outputTopic = `e2e-kafka-output-${uuidv4()}`;
        const consumerGroup = `e2e-group-${uuidv4()}`;

        const admin = new KafkaAdmin();
        let job: Job;
        let exampleData: Record<string, any>[];

        beforeAll(async () => {
            await admin.ensureTopic(inputTopic);
            await admin.ensureTopic(outputTopic);

            exampleData = await loadData(inputTopic, 'e2e-data.txt');
        });

        afterAll(async () => {
            admin.disconnect();

            if (job) {
                try {
                    await job.stop();
                } catch (_err) {
                    // job may already be stopped
                }
            }
        });

        it('should pipe records end to end', async () => {
            job = await client.jobs.submit({
                name: 'e2e-kafka-pipeline',
                lifecycle: 'persistent',
                workers: 1,
                assets: ['kafka'],
                operations: [
                    {
                        _op: 'kafka_reader',
                        _api_name: 'kafka_reader_api'
                    },
                    {
                        _op: 'kafka_sender',
                        _api_name: 'kafka_sender_api'
                    }
                ],
                apis: [
                    {
                        _name: 'kafka_reader_api',
                        topic: inputTopic,
                        group: consumerGroup,
                        size: 100,
                        wait: 5000,
                        offset_reset: 'smallest'
                    },
                    {
                        _name: 'kafka_sender_api',
                        topic: outputTopic
                    }
                ]
            });

            await job.waitForStatus('running');

            // Poll until we have all expected messages (up to 6 × 10s = 60s)
            let consumed: any[] = [];
            for (let attempt = 0; attempt < 6; attempt++) {
                consumed = await readData(outputTopic, exampleData.length);
                if (consumed.length >= exampleData.length) break;
            }

            await job.stop();

            expect(consumed).toBeArrayOfSize(exampleData.length);
            for (let i = 0; i < exampleData.length; i++) {
                expect(consumed[i]).toEqual(exampleData[i]);
            }
        });
    });
});
