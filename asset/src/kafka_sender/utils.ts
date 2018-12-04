import { OpConfig } from '@terascope/job-components';
import { KafkaSenderConfig, CollectConfig } from './interfaces';
import isEqual from 'lodash.isequal';

export function getCollectConfig(operations: OpConfig[], opConfig: KafkaSenderConfig): CollectConfig {
    let index = operations.findIndex((op) => {
        return isEqual(op, opConfig);
    });

    if (index < 0) {
        throw new Error('No kafka_sender config found in job config');
    }

    while (index > 0) {
        const op = operations[--index] ;
        if (isCollectConfig(op)) {
            if (op.wait == null || op.size == null) {
                throw new Error('Collect is not configured collectly');
            }
            return op;
        }
    }

    throw new Error('Kafka Sender no longer handles "wait" and "size", use the "collect" op');
}

function isCollectConfig(op: OpConfig): op is CollectConfig {
    return op._op === 'collect';
}
