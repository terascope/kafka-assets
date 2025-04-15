# Kafka Asset Bundle

[![codecov](https://codecov.io/gh/terascope/kafka-assets/branch/master/graph/badge.svg)](https://codecov.io/gh/terascope/kafka-assets)

> A bundle of [Kafka](https://kafka.apache.org/) operations and apis for [Teraslice](https://github.com/terascope/teraslice).

- [Kafka Asset Bundle](#kafka-asset-bundle)
  - [Releases](#releases)
  - [Getting Started](#getting-started)
  - [Connectors](#connectors)
    - [Kafka Connector](#kafka-connector)
  - [Development](#development)
    - [Tests](#tests)
    - [Build](#build)
  - [Contributing](#contributing)
  - [License](#license)

## Releases

You can find a list of releases, changes, and pre-built asset bundles [here](https://github.com/terascope/kafka-assets/releases).

## Getting Started

This asset bundle requires a running Teraslice cluster, you can find the documentation [here](https://terascope.github.io/teraslice/docs/overview/).

```bash
# Step 1: make sure you have teraslice-cli installed
yarn global add teraslice-cli

# Step 2:
teraslice-cli asset deploy localhost terascope/kafka-assets@4.2.2
```

**IMPORTANT:** Additionally make sure have installed the required [connectors](#connectors).

## Connectors

### Kafka Connector

> Terafoundation connector for Kafka producer and consumer clients.

To install from the root of your terafoundation based service.

```bash
npm install terafoundation_kafka_connector
```

**Note:** The terafoundation connector is preinstalled in Teraslice

**Configuration:**

The terafoundation level configuration is as follows:

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| brokers | List of seed brokers for the kafka environment | String[] | optional, defaults to `["localhost:9092"]` |
| security_protocol | Protocol used to communicate with brokers, may be set to `plaintext` or `ssl` | String | optional, defaults to `plaintext` |
| ssl_ca_location | File or directory path to CA certificate(s) for verifying the broker's key. Ignored if `caCertificate` is provided. | String | only used when `security_protocol` is set to `ssl` |
| caCertificate | CA certificate string (PEM format) for verifying the broker's key. If provided `ssl_ca_location` will be ignored. | String | only used when `security_protocol` is set to `ssl` |
| ssl_certificate_location | Path to client's public key (PEM) used for authentication | String | only used when `security_protocol` is set to `ssl` |
| ssl_crl_location | Path to CRL for verifying broker's certificate validity | String | only used when `security_protocol` is set to `ssl` |
| ssl_key_location | Path to client's private key (PEM) used for authentication | String | only used when `security_protocol` is set to `ssl` |
| ssl_key_password | Private key passphrase | String | only used when `security_protocol` is set to `ssl` |

When using this connector in code, this connector exposes two different client implementations. One for producers `type: producer` and one for consumers `type: consumer`.

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| options | Consumer or Producer specific options | Object | required, see below |
| topic_options | [librdkafka defined settings](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md) that apply per topic | Object | optional, defaults to `{}` |
| rdkafka_options | [librdkafka defined settings](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md) that are not subscription specific | Object | optional, defaults to `{}` |

The `options` object enables setting a few properties

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| type | What type of connector is required, either `consumer` or `producer`. | String | required, defaults to `consumer` |
| group | For type 'consumer', what consumer group to use | String | optional |
| poll_interval | For type 'producer', how often (in milliseconds) the producer connection is polled to keep it alive. | Number | optional, defaults to `100` |

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

With an encrypted connection to kafka broker:

```yaml
terafoundation:
    connectors:
        kafka:
            default:
                brokers: "localhost:9092"
                security_protocol: "ssl"
                ssl_ca_location: "app/certs/CAs/rootCA.pem" # will be ignored if caCertificate is provided
                caCertificate: | # if provided then ssl_ca_location will be ignored 
                    -----BEGIN CERTIFICATE-----
                    MIIFJzCCA4+gAwIBAgIQX6DM59eAmZLzzdoyD0jbtDANBgkqhkiG9w0BAQsFADCB
                    ...
                    ...
                    ...
                    R4eNRWMls7ceteGynZLUL0LULwW8Wio8w3Ht
                    -----END CERTIFICATE-----
```

## Development

### Tests

Run the kafka tests

**Requirements:**

- `docker` - A Kafka container will be created using [Docker](https://docs.docker.com/get-started/)

**Environment:**

- `KAFKA_BROKERS` - Defaults to `localhost:9092`

```bash
yarn test
```

### Build

Build a compiled asset bundle to deploy to a teraslice cluster.

#### Install Teraslice CLI

```bash
yarn global add teraslice-cli
```

```bash
teraslice-cli assets build
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](./LICENSE) licensed.
