### Kafka Connector

> Terafoundation connector for Kafka producer and consumer clients.

To install from the root of your terafoundation based service.

```bash
npm install terafoundation_kafka_connector
```

**Configuration:**

This connector exposes two different client implementations. One for producers `type: producer` and one for consumers `type: consumer`.

| Name | Description | Default | Required |
| ---- | ----------- | ------- | -------- |
| brokers | List of kafka brokers to use | `localhost:9092` | N |
| options | Consumer group to join. Only applies to type: consumer | see below | Y |
| topic_options | [librdkafka defined settings](https://github.com/edenhill/librdkafka/blob/v0.11.5/CONFIGURATION.md) that apply per topic. | `{}` | N |
| rdkafka_options | [librdkafka defined settings](https://github.com/edenhill/librdkafka/blob/v0.11.5/CONFIGURATION.md) that are not subscription specific. | `{}` | N |

The `options` object enables setting a few properties

| type | What type of connector is required. "consumer" or "producer". | consumer | N |
| group | For type = 'consumer' what consumer group to use | terafoundation_kafka_connector | N |
| poll_interval | For type = 'producer', how often (in milliseconds) the producer connection is polled to keep it alive. | `100` | N |

***Consumer connector configuration example:**

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

***Producer connector configuration example:**

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
