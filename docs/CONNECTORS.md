### Kafka Connector

> Terafoundation connector for Kafka producer and consumer clients.

To install from the root of your terafoundation based service.

```bash
npm install terafoundation_kafka_connector
```

**Configuration:**

The terafoundation level configuration is as follows:

|            Field             |          Type          |      Default       |                                Description                                 |
| :--------------------------: | :--------------------: | :----------------: | :------------------------------------------------------------------------: |
|         **brokers**          |        `Array`         | `"localhost:9092"` |               List of seed brokers for the kafka environment               |
|    **security_protocol**     | `"plaintext"`, `"ssl"` |   `"plaintext"`    |                 Protocol used to communicate with brokers                  |
|     **ssl_ca_location**      |        `String`        |         -          | File or directory path to CA certificate(s) for verifying the broker's key |
| **ssl_certificate_location** |        `String`        |         -          |         Path to client's public key (PEM) used for authentication          |
|     **ssl_crl_location**     |        `String`        |         -          |          Path to CRL for verifying broker's certificate validity           |
|     **ssl_key_location**     |        `String`        |         -          |         Path to client's private key (PEM) used for authentication         |
|     **ssl_key_password**     |        `String`        |         -          |                           Private key passphrase                           |

When using this connector in code, this connector exposes two different client implementations. One for producers `type: producer` and one for consumers `type: consumer`.


| Name                | Description                                                                                                                             | Default   | Required |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| **options**         | Consumer or Producer specific options                                                                                                   | see below | Y        |
| **topic_options**   | [librdkafka defined settings](https://github.com/edenhill/librdkafka/blob/v0.11.5/CONFIGURATION.md) that apply per topic.               | `{}`      | N        |
| **rdkafka_options** | [librdkafka defined settings](https://github.com/edenhill/librdkafka/blob/v0.11.5/CONFIGURATION.md) that are not subscription specific. | `{}`      | N        |

The `options` object enables setting a few properties

| Name              | Description                                                                                          | Default    | Required |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ---------- | -------- |
| **type**          | What type of connector is required. "consumer" or "producer".                                        | `consumer` | N        |
| **group**         | For type 'consumer', what consumer group to use                                                      | `N/A`      | N        |
| **poll_interval** | For type 'producer', how often (in milliseconds) the producer connection is polled to keep it alive. | `100`      | N        |

**Consumer connector configuration example:**

```js
{
    options: {
        type: 'consumer',
        group: 'example-group'
    },
    topic_options: {
        'enable.auto.commit': false
    },
    rdkafka_options: {
        'fetch.min.bytes': 100000
    }
}
```

**Producer connector configuration example:**

```js
{
    options: {
        type: 'producer',
        poll_interval: 1000,
    },
    topic_options: {},
    rdkafka_options: {
        'compression.codec': 'gzip',
        'topic.metadata.refresh.interval.ms': -1,
        'log.connection.close': false,
    }
}
```

**Terafoundation configuration example:**

```yaml
terafoundation:
    connectors:
        kafka:
            default:
                brokers: "localhost:9092"
```
