---
title: terafoundation_kafka_connector
sidebar_label: terafoundation_kafka_connector
---

The Terafoundation Kafka Connector facilitates a connection between a [terafoundation](https://terascope.github.io/teraslice/docs/packages/terafoundation/overview) based project and one or more [kafka](https://kafka.apache.org) instances.

See the [overview](/) for installation and configuration details.

## Configuration Hierarchy

Kafka settings are applied at multiple levels, with more specific settings overriding general ones:

```
1. Connector Config (lowest priority - global/cluster level)
       ↓
2. Job Config - Operation parameters (job level)
       ↓
3. Job Config - rdkafka_options (job level, highest priority)
```

### Level 1: Connector Config (Terafoundation)

Global settings defined in the terafoundation configuration. Primarily used for connection settings like brokers and SSL configuration.

```yaml
terafoundation:
    connectors:
        kafka:
            default:
                brokers: "localhost:9092"
                security_protocol: "ssl"
                ssl_ca_location: "path/to/ca.pem"
```

### Level 2: Job Config - Operation Parameters

Operation-specific settings defined in the job configuration. These provide convenient named parameters that map to underlying librdkafka settings.

```json
{
    "_op": "kafka_reader",
    "topic": "my-topic",
    "group": "my-group",
    "max_poll_interval": "5 minutes"
}
```

### Level 3: Job Config - rdkafka_options (Highest Priority)

Also set at the job level, `rdkafka_options` provides direct access to [librdkafka configuration](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md). These settings override both connector-level settings and operation parameters. Use the librdkafka key names (with dots).

```json
{
    "_op": "kafka_reader",
    "topic": "my-topic",
    "group": "my-group",
    "max_poll_interval": "5 minutes",
    "rdkafka_options": {
        "max.poll.interval.ms": 600000
    }
}
```

### Example: max_poll_interval Override

The `max_poll_interval` setting demonstrates this hierarchy:

| Level | Setting | Value |
|-------|---------|-------|
| Job Config | `max_poll_interval` | `"5 minutes"` (300000ms) |
| Job Config | `rdkafka_options["max.poll.interval.ms"]` | `600000` |
| **Effective Value** | | **600000ms** (rdkafka_options wins) |

The `rdkafka_options` value takes precedence because it's applied last, even though both are set at the job level.

### When to Use rdkafka_options

- **Recommended**: For advanced tuning not exposed through operation config (e.g., `fetch.min.bytes`, `compression.codec`)
- **Not Recommended**: Overriding connector-level settings like brokers or SSL, as this can cause inconsistency across jobs
