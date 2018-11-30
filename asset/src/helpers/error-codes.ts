
export const codeToMessage = {
    '-200': 'Begin internal error codes',
    '-199': 'Received message is incorrect',
    '-198': 'Bad/unknown compression',
    '-197': 'Broker is going away',
    '-196': 'Generic failure',
    '-195': 'Broker transport failure',
    '-194': 'Critical system resource',
    '-193': 'Failed to resolve broker',
    '-192': 'Produced message timed out',
    '-191': 'Reached the end of the topic+partition queue on the broker. Not really an error.',
    '-190': 'Permanent: Partition does not exist in cluster.',
    '-189': 'File or filesystem error',
    '-188': 'Permanent: Topic does not exist in cluster.',
    '-187': 'All broker connections are down.',
    '-186': 'Invalid argument, or invalid configuration',
    '-185': 'Operation timed out',
    '-184': 'Queue is full',
    '-183': 'ISR count < required.acks',
    '-182': 'Broker node update',
    '-181': 'SSL error',
    '-180': 'Waiting for coordinator to become available.',
    '-179': 'Unknown client group',
    '-178': 'Operation in progress',
    '-177': 'Previous operation in progress, wait for it to finish.',
    '-176': 'This operation would interfere with an existing subscription',
    '-175': 'Assigned partitions (rebalance_cb)',
    '-174': 'Revoked partitions (rebalance_cb)',
    '-173': 'Conflicting use',
    '-172': 'Wrong state',
    '-171': 'Unknown protocol',
    '-170': 'Not implemented',
    '-169': 'Authentication failure',
    '-168': 'No stored offset',
    '-167': 'Outdated',
    '-166': 'Timed out in queue',
    '-165': 'Feature not supported by broker',
    '-164': 'Awaiting cache update',
    '-100': 'End internal error codes',
    '-1': 'Unknown broker error',
    0: 'Success',
    1: 'Offset out of range',
    2: 'Invalid message',
    3: 'Unknown topic or partition',
    4: 'Invalid message size',
    5: 'Leader not available',
    6: 'Not leader for partition',
    7: 'Request timed out',
    8: 'Broker not available',
    9: 'Replica not available',
    10: 'Message size too large',
    11: 'StaleControllerEpochCode',
    12: 'Offset metadata string too large',
    13: 'Broker disconnected before response received',
    14: 'Group coordinator load in progress',
    15: 'Group coordinator not available',
    16: 'Not coordinator for group',
    17: 'Invalid topic',
    18: 'Message batch larger than configured server segment size',
    19: 'Not enough in-sync replicas',
    20: 'Message(s) written to insufficient number of in-sync replicas',
    21: 'Invalid required acks value',
    22: 'Specified group generation id is not valid',
    23: 'Inconsistent group protocol',
    24: 'Invalid group.id',
    25: 'Unknown member',
    26: 'Invalid session timeout',
    27: 'Group rebalance in progress',
    28: 'Commit offset data size is not valid',
    29: 'Topic authorization failed',
    30: 'Group authorization failed',
    31: 'Cluster authorization failed'
};

const KAFKA_NO_OFFSET_STORED = -168;
const ERR__WAIT_COORD = -180;
const ERR_NOT_COORDINATOR_FOR_GROUP = 16;
const ERR__TIMED_OUT_QUEUE = -166;

export interface OkErrorSet {
    [prop: number]: boolean;
}

export interface OkErrors {
    consume: OkErrorSet;
    commit: OkErrorSet;
}

export const okErrors: OkErrors = {
    consume: {},
    commit: {},
};

okErrors.consume[KAFKA_NO_OFFSET_STORED] = true;
okErrors.consume[ERR__WAIT_COORD] = true;
okErrors.consume[ERR_NOT_COORDINATOR_FOR_GROUP] = true;
okErrors.consume[ERR__TIMED_OUT_QUEUE] = true;

// If this is the first slice and the slice is Empty
// there may be no offsets stored which is not really
// an error.
okErrors.commit[KAFKA_NO_OFFSET_STORED] = true;
