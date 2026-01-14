---
title: terafoundation_kafka_connector
sidebar_label: terafoundation_kafka_connector
---

The Terafoundation Kafka Connector facilitates a connection between a [terafoundation](https://terascope.github.io/teraslice/docs/packages/terafoundation/overview) based project and one or more [kafka](https://kafka.apache.org) instances. It uses [@confluentinc/kafka-javascript](https://github.com/confluentinc/kafka-javascript) (librdkafka) under the hood.

## Installation

```bash
npm install terafoundation_kafka_connector
```

**Note:** This connector is preinstalled in Teraslice.

## Quick Reference

### Terafoundation Configuration

```yaml
terafoundation:
    connectors:
        kafka:
            default:
                brokers: ["localhost:9092"]
                security_protocol: "plaintext"  # or "ssl"
```

### Client Configuration

**Consumer Example:**
```javascript
const settings = {
    options: {
        type: 'consumer',
        group: 'my-consumer-group'
    },
    topic_options: {
        'enable.auto.commit': false
    },
    rdkafka_options: {
        'fetch.min.bytes': 100000
    }
};

const { client } = await connector.createClient(config, logger, settings);
```

**Producer Example:**
```javascript
const settings = {
    options: {
        type: 'producer',
        poll_interval: 1000
    },
    rdkafka_options: {
        'compression.codec': 'gzip'
    }
};

const { client } = await connector.createClient(config, logger, settings);
```

### Key Configuration Parameters

**Terafoundation Level:**

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `brokers` | List of Kafka brokers | String[] | `["localhost:9092"]` |
| `security_protocol` | Protocol: `plaintext` or `ssl` | String | `plaintext` |
| `ssl_ca_location` | Path to CA certificate (ignored if `caCertificate` provided) | String | - |
| `caCertificate` | CA certificate in PEM format (overrides `ssl_ca_location`) | String | - |
| `ssl_certificate_location` | Path to client certificate (PEM) | String | - |
| `ssl_key_location` | Path to client private key (PEM) | String | - |
| `ssl_key_password` | Private key passphrase | String | - |

**Client Level:**

| Parameter | Description | Type | Default |
|-----------|-------------|------|---------|
| `options.type` | Client type: `consumer` or `producer` | String | `consumer` |
| `options.group` | Consumer group (consumers only) | String | - |
| `options.poll_interval` | Producer poll interval in ms (producers only) | Number | `100` |
| `topic_options` | [librdkafka topic settings](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md) | Object | `{}` |
| `rdkafka_options` | [librdkafka client settings](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md) | Object | `{}` |

### SSL Configuration Example

```yaml
terafoundation:
    connectors:
        kafka:
            default:
                brokers: ["broker1:9093", "broker2:9093"]
                security_protocol: "ssl"
                caCertificate: |
                    -----BEGIN CERTIFICATE-----
                    MIIFJzCCA4+gAwIBAgIQX6DM59eAmZLzzdoyD0jbtDANBgk...
                    -----END CERTIFICATE-----
                ssl_certificate_location: "/path/to/client-cert.pem"
                ssl_key_location: "/path/to/client-key.pem"
                ssl_key_password: "my-key-password"
```

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
