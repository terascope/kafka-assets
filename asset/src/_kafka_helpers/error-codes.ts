// copied from https://github.com/confluentinc/confluent-kafka-javascript/blob/master/lib/error.js
// @confluentinc/kafka-javascript version 1.8.0, librdkafka 2.13.0

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
    '-163': 'Operation interrupted',
    '-162': 'Key serialization error',
    '-161': 'Value serialization error',
    '-160': 'Key deserialization error',
    '-159': 'Value deserialization error',
    '-158': 'Partial response',
    '-157': 'Modification attempted on read-only object',
    '-156': 'No such entry / item not found',
    '-155': 'Read underflow',
    '-154': 'Invalid type',
    '-153': 'Retry operation',
    '-152': 'Purged in queue',
    '-151': 'Purged in flight',
    '-150': 'Fatal error: see RdKafka::Handle::fatal_error()',
    '-149': 'Inconsistent state',
    '-148': 'Gap-less ordering would not be guaranteed if proceeding',
    '-147': 'Maximum poll interval exceeded',
    '-146': 'Unknown broker',
    '-145': 'Functionality not configured',
    '-144': 'Instance has been fenced',
    '-143': 'Application generated error',
    '-142': 'Assignment lost',
    '-141': 'No operation performed',
    '-140': 'No offset to automatically reset to',
    '-139': 'Partition log truncation detected',
    '-138': 'A different record in the batch was invalid and this message failed persisting.',
    '-137': 'Broker is going away but client isn\'t terminating',
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
    31: 'Cluster authorization failed',
    32: 'Invalid timestamp',
    33: 'Unsupported SASL mechanism',
    34: 'Illegal SASL state',
    35: 'Unuspported version',
    36: 'Topic already exists',
    37: 'Invalid number of partitions',
    38: 'Invalid replication factor',
    39: 'Invalid replica assignment',
    40: 'Invalid config',
    41: 'Not controller for cluster',
    42: 'Invalid request',
    43: 'Message format on broker does not support request',
    44: 'Policy violation',
    45: 'Broker received an out of order sequence number',
    46: 'Broker received a duplicate sequence number',
    47: 'Producer attempted an operation with an old epoch',
    48: 'Producer attempted a transactional operation in an invalid state',
    49: 'Producer attempted to use a producer id which is not currently assigned to its transactional id',
    50: 'Transaction timeout is larger than the maximum value allowed by the broker\'s max.transaction.timeout.ms',
    51: 'Producer attempted to update a transaction while another concurrent operation on the same transaction was ongoing',
    52: 'Indicates that the transaction coordinator sending a WriteTxnMarker is no longer the current coordinator for a given producer',
    53: 'Transactional Id authorization failed',
    54: 'Security features are disabled',
    55: 'Operation not attempted',
    56: 'Disk error when trying to access log file on the disk',
    57: 'The user-specified log directory is not found in the broker config',
    58: 'SASL Authentication failed',
    59: 'Unknown Producer Id',
    60: 'Partition reassignment is in progress',
    61: 'Delegation Token feature is not enabled',
    62: 'Delegation Token is not found on server',
    63: 'Specified Principal is not valid Owner/Renewer',
    64: 'Delegation Token requests are not allowed on this connection',
    65: 'Delegation Token authorization failed',
    66: 'Delegation Token is expired',
    67: 'Supplied principalType is not supported',
    68: 'The group is not empty',
    69: 'The group id does not exist',
    70: 'The fetch session ID was not found',
    71: 'The fetch session epoch is invalid',
    72: 'No matching listener',
    73: 'Topic deletion is disabled',
    74: 'Leader epoch is older than broker epoch',
    75: 'Leader epoch is newer than broker epoch',
    76: 'Unsupported compression type',
    77: 'Broker epoch has changed',
    78: 'Leader high watermark is not caught up',
    79: 'Group member needs a valid member ID',
    80: 'Preferred leader was not available',
    81: 'Consumer group has reached maximum size',
    82: 'Static consumer fenced by other consumer with same group.instance.id.',
    83: 'Eligible partition leaders are not available',
    84: 'Leader election not needed for topic partition',
    85: 'No partition reassignment is in progress',
    86: 'Deleting offsets of a topic while the consumer group is subscribed to it',
    87: 'Broker failed to validate record',
    88: 'There are unstable offsets that need to be cleared',
    89: 'Throttling quota has been exceeded',
    90: 'There is a newer producer with the same transactionalId which fences the current one',
    91: 'Request illegally referred to resource that does not exist',
    92: 'Request illegally referred to the same resource twice',
    93: 'Requested credential would not meet criteria for acceptability',
    94: 'Indicates that the either the sender or recipient of a voter-only request is not one of the expected voters',
    95: 'Invalid update version',
    96: 'Unable to update finalized features due to server error',
    97: 'Request principal deserialization failed during forwarding',
    100: 'Unknown Topic Id',
    110: 'The member epoch is fenced by the group coordinator',
    111: 'The instance ID is still used by another member in the consumer group',
    112: 'The assignor or its version range is not supported by the consumer group',
    113: 'The member epoch is stale',
    117: 'Client sent a push telemetry request with an invalid or outdated subscription ID.',
    118: 'Client sent a push telemetry request larger than the maximum size the broker will accept.',
    129: 'Client metadata is stale, client should rebootstrap to obtain new metadata.',
} as Record<(string | number), any>;

export const KAFKA_NO_OFFSET_STORED = -168;
export const ERR__WAIT_COORD = -180;
export const ERR_NOT_COORDINATOR_FOR_GROUP = 16;
export const ERR__TIMED_OUT_QUEUE = -166;
export const ERR__ASSIGN_PARTITIONS = -175;
export const ERR__REVOKE_PARTITIONS = -174;
export const ERR__PREV_IN_PROGRESS = -177;
export const ERR__TRANSPORT = -195;
export const ERR__MSG_TIMED_OUT = -192;
export const ERR__PARTITION_EOF = -191;
export const ERR__WAIT_CACHE = -164;
export const ERR__TIMED_OUT = -185;
export const ERR__QUEUE_FULL = -184;
export const ERR_NO_ERROR = 0;
export const ERR_REQUEST_TIMED_OUT = 7;
export const ERR__RESOLVE = -193;
export const ERR_UNKNOWN_TOPIC_OR_PART = 3;
export const ERR__STATE = -172;

export interface OkErrorSet {
    [prop: number]: boolean;
}

export enum OkErrorKeys {
    consume = 'consume',
    commit = 'commit',
    produce = 'produce',
    connect = 'connect',
    retryable = 'retryable',
    any = 'any'
}

export interface OkErrors {
    [OkErrorKeys.consume]: OkErrorSet;
    [OkErrorKeys.commit]: OkErrorSet;
    [OkErrorKeys.produce]: OkErrorSet;
    [OkErrorKeys.connect]: OkErrorSet;
    [OkErrorKeys.retryable]: OkErrorSet;
    [OkErrorKeys.any]: OkErrorSet;
}

export const okErrors: OkErrors = {
    consume: {},
    commit: {},
    produce: {},
    connect: {},
    retryable: {},
    any: {},
};

okErrors.consume[KAFKA_NO_OFFSET_STORED] = true;
okErrors.consume[ERR__WAIT_COORD] = true;
okErrors.consume[ERR_NOT_COORDINATOR_FOR_GROUP] = true;
okErrors.consume[ERR__TIMED_OUT_QUEUE] = true;

// If this is the first slice and the slice is Empty
// there may be no offsets stored which is not really
// an error.
okErrors.commit[KAFKA_NO_OFFSET_STORED] = true;

okErrors.produce[ERR__MSG_TIMED_OUT] = true;

okErrors.retryable[ERR__TIMED_OUT] = true;
okErrors.retryable[ERR__TRANSPORT] = true;
okErrors.retryable[ERR__WAIT_CACHE] = true;
okErrors.retryable[ERR__QUEUE_FULL] = true;
okErrors.retryable[ERR__RESOLVE] = true;
okErrors.retryable[ERR__STATE] = true;

okErrors.any[ERR__PARTITION_EOF] = true;
okErrors.any[ERR_NO_ERROR] = true;
