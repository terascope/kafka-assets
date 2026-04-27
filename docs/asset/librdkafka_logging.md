# librdkafka Logging

The Kafka asset uses the [@confluentinc/kafka-javascript](https://github.com/confluentinc/confluent-kafka-javascript) client which in turn uses [librdkafka](https://github.com/confluentinc/librdkafka). librdkafka has its own logging system that operates independently of Teraslice's logger and can be configured through `rdkafka_options` on any Kafka API.

## Settings

### `debug`

Enables verbose debug logging for specific librdkafka subsystems. Accepts a comma-separated string of context names.

| Context | Description |
| ------- | ----------- |
| `generic` | Generic client logging |
| `broker` | Broker connection events |
| `topic` | Topic and partition metadata |
| `metadata` | Metadata requests and responses |
| `feature` | Feature negotiation with brokers |
| `queue` | Internal message queues |
| `msg` | Message production and consumption |
| `protocol` | Kafka protocol framing |
| `cgrp` | Consumer group coordination |
| `security` | SSL/SASL authentication |
| `fetch` | Fetch request details |
| `interceptor` | Interceptor plugin events |
| `plugin` | Plugin loading |
| `consumer` | Consumer-level events |
| `admin` | Admin client operations |
| `eos` | Exactly-once semantics (idempotent producer) |
| `mock` | Mock cluster events |
| `assignor` | Partition assignor |
| `conf` | Configuration dump at client creation |
| `all` | All of the above |

### `log_level`

Controls the severity threshold for librdkafka's internal log output. Uses standard syslog severity levels.

| Value | Level | Description |
| ----- | ----- | ----------- |
| `0` | EMERG | System is unusable |
| `1` | ALERT | Action must be taken immediately |
| `2` | CRIT | Critical conditions |
| `3` | ERR | Error conditions |
| `4` | WARNING | Warning conditions |
| `5` | NOTICE | Normal but significant conditions |
| `6` | INFO | Informational messages (default) |
| `7` | DEBUG | Debug-level messages |

The default is `6` (INFO). Set to `7` to see all debug output from librdkafka.

## Usage

Both settings are passed through `rdkafka_options` in the API or operation config.

### Enable full debug logging

```json
{
    "_name": "kafka_reader_api",
    "topic": "my-topic",
    "group": "my-group",
    "rdkafka_options": {
        "log_level": 7,
        "debug": "all"
    }
}
```

### Debug only broker connections and consumer group coordination

```json
{
    "_name": "kafka_sender_api",
    "topic": "my-topic",
    "rdkafka_options": {
        "log_level": 7,
        "debug": "broker,cgrp"
    }
}
```

### Suppress all but critical errors

```json
{
    "_name": "kafka_reader_api",
    "topic": "my-topic",
    "group": "my-group",
    "rdkafka_options": {
        "log_level": 2
    }
}
```

## Notes

- librdkafka log events are emitted via the client's event emitter and forwarded to Teraslice's bunyan logger at the `info` level.
- `debug: "all"` is very verbose and should only be used for troubleshooting. Avoid it in production.
- The `conf` debug context logs all resolved configuration values at startup, which is useful for verifying that settings are being applied as expected.
- API level `rdkafka_options` have the highest priority in the [Configuration Hierarchy](../packages/terafoundation_kafka_connector/overview.md#configuration-hierarchy), so these settings will override any connector-level defaults.
