// https:// github.com/edenhill/librdkafka/blob/v0.11.5/CONFIGURATION.md

export interface RDKafkaBaseOptions {
    'client.id'?: string;
    'builtin.features'?: BuiltinFeatures;
    'metadata.broker.list'?: string;
    'bootstrap.servers'?: string;
    'message.max.bytes'?: number;
    'message.copy.max.bytes'?: number;
    'receive.message.max.bytes'?: number;
    'max.in.flight.requests.per.connection'?: number;
    'max.in.flight'?: number;
    'metadata.request.timeout.ms'?: number;
    'topic.metadata.refresh.interval.ms'?: number;
    'metadata.max.age.ms'?: number;
    'topic.metadata.refresh.fast.interval.ms'?: number;
    'topic.metadata.refresh.fast.cnt'?: number;
    'topic.metadata.refresh.sparse'?: boolean;
    'topic.blacklist'?: string;
    'debug'?: string;
    'socket.timeout.ms'?: number;
    'socket.blocking.max.ms'?: number;
    'socket.send.buffer.bytes'?: number;
    'socket.receive.buffer.bytes'?: number;
    'socket.keepalive.enable'?: boolean;
    'socket.nagle.disable'?: boolean;
    'socket.max.fails'?: number;
    'broker.address.ttl'?: number;
    'broker.address.family'?: 'any'|'v4'|'v6';
    'reconnect.backoff.jitter.ms'?: number;
    'statistics.interval.ms'?: number;
    'enabled_events'?: number;
    'error_cb'?: boolean|Function;
    'dr_cb'?: boolean|Function;
    'dr_msg_cb'?: boolean|Function;
    'log_level'?: number;
    'log.queue'?: boolean;
    'log.thread.name'?: boolean;
    'log.connection.close'?: boolean;
    'internal.termination.signal'?: number;
    'api.version.request'?: boolean;
    'api.version.request.timeout.ms'?: number;
    'api.version.fallback.ms'?: number;
    'broker.version.fallback'?: string;
    'security.protocol'?: SecurityProtocol;
    'ssl.cipher.suites'?: string;
    'ssl.curves.list'?: string;
    'ssl.sigalgs.list'?: string;
    'ssl.key.location'?: string;
    'ssl.key.password'?: string;
    'ssl.certificate.location'?: string;
    'ssl.ca.location'?: string;
    'ssl.crl.location'?: string;
    'ssl.keystore.location'?: string;
    'ssl.keystore.password'?: string;
    'sasl.mechanisms'?: string;
    'sasl.mechanism'?: string;
    'sasl.kerberos.principal'?: string;
    'sasl.kerberos.kinit.cmd'?: string;
    'sasl.kerberos.keytab'?: string;
    'sasl.kerberos.min.time.before.relogin'?: string;
    'sasl.username'?: string;
    'sasl.password'?: string;
    'plugin.library.paths'?: string;
    'group.id'?: string;
    'partition.assignment.strategy'?: PartitionAssignmentStrategy;
    'session.timeout.ms'?: number;
    'heartbeat.interval.ms'?: number;
    'group.protocol.type'?: 'consumer'|string;
    'coordinator.query.interval.ms'?: number;
}

export type BuiltinFeatures = 'gzip'|'snappy'|'ssl'|'sasl'|'regex'|'lz4'|'sasl_gssapi'|'sasl_plain'|'sasl_scram'|'plugins';
export const producerDebugOptions = ['broker', 'topic', 'msg'];
export const consumerDebugOptions = ['consumer', 'cgrp', 'topic', 'fetch'];

export type SecurityProtocol = 'plaintext'|'ssl'|'sasl_plaintext'|'sasl_ssl';
export type PartitionAssignmentStrategy = 'range'|'roundrobin';

export interface RDKafkaConsumerOptions extends RDKafkaBaseOptions {
    'enable.auto.commit'?: boolean;
    'auto.commit.interval.ms'?: number;
    'enable.auto.offset.store'?: boolean;
    'queued.min.messages'?: number;
    'queued.max.messages.kbytes'?: number;
    'fetch.wait.max.ms'?: number;
    'fetch.message.max.bytes'?: number;
    'max.partition.fetch.bytes'?: number;
    'fetch.max.bytes'?: number;
    'fetch.min.bytes'?: number;
    'fetch.error.backoff.ms'?: number;
    'offset.store.method'?: FileStoreMethod;
    'enable.partition.eof'?: boolean;
    'check.crcs'?: boolean;
}

export interface RDKafkaProducerOptions extends RDKafkaBaseOptions {
    'queue.buffering.max.messages'?: number;
    'queue.buffering.max.kbytes'?: number;
    'queue.buffering.max.ms'?: number;
    'linger.ms'?: number;
    'message.send.max.retries'?: number;
    'retries'?: number;
    'retry.backoff.ms'?: number;
    'queue.buffering.backpressure.threshold'?: number;
    'compression.codec'?: 'none'|'gzip'|'snappy'|'lz4';
    'compression.type'?: 'none'|'gzip'|'snappy'|'lz4';
    'batch.num.messages'?: number;
    'delivery.report.only.error'?: boolean;
}

export interface RDKafkaProducerTopicOptions {
    'request.required.acks'?: number;
    'acks'?: number;
    'request.timeout.ms'?: number;
    'message.timeout.ms'?: number;
    'queuing.strategy'?: 'fifo'|'lifo'|'fifo';
    'produce.offset.report'?: boolean;
    'partitioner'?: string;
    'partitioner_cb'?: boolean|Function;
    'compression.codec'?: CompressionCodec;
    'compression.type'?: CompressionCodec;
    'compression.level'?: number;
}

export type CompressionCodec = 'none'|'gzip'|'snappy'|'lz4'|'inherit';

export interface RDKafkaConsumerTopicOptions {
    'auto.commit.enable'?: boolean;
    'enable.auto.commit'?: boolean;
    'auto.commit.interval.ms'?: number;
    'auto.offset.reset'?: OffsetReset;
    'offset.store.path'? : string;
    'offset.store.sync.interval.ms' ? : number;
    'offset.store.method': FileStoreMethod;
    'consume.callback.max.messages' ? : number;
}

export type FileStoreMethod = 'none'|'file'|'broker';

export type OffsetReset = 'smallest' | 'earliest' | 'beginning' | 'largest' | 'latest' | 'end' | 'error';
