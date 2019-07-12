# Kafka Asset Bundle

[![Build Status](https://travis-ci.org/terascope/kafka-assets.svg?branch=master)](https://travis-ci.org/terascope/kafka-assets)
[![codecov](https://codecov.io/gh/terascope/kafka-assets/branch/master/graph/badge.svg)](https://codecov.io/gh/terascope/kafka-assets)

> A bundle of [Kafka](https://kafka.apache.org/) operations and processors for [Teraslice](https://github.com/terascope/teraslice).


- [Releases](#releases)
- [Getting Started](#getting-started)
- [Connectors](#connectors)
  - [Kafka Connector](#kafka-connector)
- [Operations](#operations)
  - [Kafka Dead Letter](#kafka-dead-letter)
  - [Kafka Reader](#kafka-reader)
  - [Kafka Sender](#kafka-sender)
- [Development](#development)
  - [Tests](#tests)
  - [Build](#build)
  - [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Releases

You can find a list of releases, changes, and pre-built asset bundles [here](https://github.com/terascope/kafka-assets/releases).

## Getting Started

This asset bundle requires a running Teraslice cluster, you can find the documentation [here](https://github.com/terascope/teraslice/blob/master/README.md).

```bash
# Step 1: make sure you have teraslice-cli installed
yarn global add teraslice-cli

# Step 2:
# FIXME: this should be accurate
teraslice-cli asset deploy ...
```

**IMPORTANT:** Additionally make sure have installed the required [connectors](#connectors).

## Connectors

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

## Operations

### Kafka Dead Letter

> Write bad records to a kafka topic

**IMPORTANT:** Requires teraslice `v0.45.0` or greater

**Name:** `kafka_dead_letter`

**Type:** `API`

**Configuration:**

|               Field               |                         Type                         |   Default   |                                                                                                                                                                                                                                                   Description                                                                                                                                                                                                                                                    |
| :-------------------------------: | :--------------------------------------------------: | :---------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|      **_dead_letter_action**      |                       `String`                       |  `"none"`   | This action will specify what to do when failing to parse or transform a record. ​​​​​<br>​​​​​The following builtin actions are supported: ​​​<br>​​​​​  - "throw": throw the original error ​​​​​<br>​​​​​  - "log": log the error and the data ​​​​​<br>​​​​​  - "none": (default) skip the error entirely<br><br>​​​​​If none of the actions are specified it will try and use a registered Dead Letter Queue API under that name.<br>The API must be already be created by a operation before it can used.​ |
|           **_encoding**           |                       `"json"`                       |  `"json"`   |                                                                                                                                                                                                        Used for specifying the data encoding type when using `DataEntity.fromBuffer`. Defaults to `json`.                                                                                                                                                                                                        |
|              **_op**              |                       `String`                       |      -      |                                                                                                                                                                                                                       Name of operation, , it must reflect the name of the file or folder                                                                                                                                                                                                                        |
|          **compression**          | `"none"`, `"gzip"`, `"snappy"`, `"lz4"`, `"inherit"` |  `"gzip"`   |                                                                                                                                                                                                                                            Type of compression to use                                                                                                                                                                                                                                            |
|          **connection**           |                       `String`                       | `"default"` |                                                                                                                                                                                                                                      The Kafka producer connection to use.                                                                                                                                                                                                                                       |
|       **metadata_refresh**        |                       `Number`                       |  `300000`   |                                                                                                                                                                                                       How often the producer will poll the broker for metadata information. Set to -1 to disable polling.                                                                                                                                                                                                        |
| **partition_assignment_strategy** |           `"range"`, `"roundrobin"`, `""`            |      -      |                                                                                                                                                                                                   Name of partition assignment strategy to use when elected group leader assigns partitions to group members.                                                                                                                                                                                                    |
|             **size**              |                       `Number`                       |   `10000`   |                                                                                                                                                                                                                          How many messages will be batched and sent to kafka together.                                                                                                                                                                                                                           |
|             **topic**             |                       `String`                       |      -      |                                                                                                                                                                                                                                     Name of the Kafka topic to send data to                                                                                                                                                                                                                                      |
|             **wait**              |                       `Number`                       |    `500`    |                                                                                                                                                                                                                    How long to wait for `size` messages to become available on the producer.                                                                                                                                                                                                                     |

**Example Job Config:**

```js
{
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.1.3"
    "assets": [ "kafka" ],
    "apis": [
        {
            "_name": "kafka_dead_letter",
            // Specify the topic to push the dead letter queue to
            "topic" : "a9bs823...",
        }
    ],
    // ...
    "operations": [
        // This example uses the kafka reader, but any processor that supports the dead letter API should be able to support the kafka dead letter queue
        {
            "_op": "kafka_reader",
            // Make sure to specify the dead letter action
            "_dead_letter_action": "kafka_dead_letter",
            // the kafka topic to subscribe to
            "topic": "d9c7ba7..."
            // the kafka consumer group
            "group": "4e69b5271-4a6..."
        },
    ]
    // ...
}
```

### Kafka Reader

> Read data in chunks from a kafka topic

**Name:** `kafka_reader`

**Type:** `Reader`

**Configuration:**

|               Field               |                                     Type                                      |   Default    |                                                                                                                                                                                                                                                   Description                                                                                                                                                                                                                                                    |
| :-------------------------------: | :---------------------------------------------------------------------------: | :----------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|      **_dead_letter_action**      |                                   `String`                                    |   `"none"`   | This action will specify what to do when failing to parse or transform a record. ​​​​​<br>​​​​​The following builtin actions are supported: ​​​<br>​​​​​  - "throw": throw the original error ​​​​​<br>​​​​​  - "log": log the error and the data ​​​​​<br>​​​​​  - "none": (default) skip the error entirely<br><br>​​​​​If none of the actions are specified it will try and use a registered Dead Letter Queue API under that name.<br>The API must be already be created by a operation before it can used.​ |
|           **_encoding**           |                                   `"json"`                                    |   `"json"`   |                                                                                                                                                                                                        Used for specifying the data encoding type when using `DataEntity.fromBuffer`. Defaults to `json`.                                                                                                                                                                                                        |
|              **_op**              |                                   `String`                                    |      -       |                                                                                                                                                                                                                       Name of operation, , it must reflect the name of the file or folder                                                                                                                                                                                                                        |
|          **connection**           |                                   `String`                                    | `"default"`  |                                                                                                                                                                                                                                      The Kafka consumer connection to use.                                                                                                                                                                                                                                       |
|             **group**             |                                   `String`                                    |      -       |                                                                                                                                                                                                                                         Name of the Kafka consumer group                                                                                                                                                                                                                                         |
|           **interval**            |                                   `Number`                                    |     `50`     |                                                                                                                                                                                      How often to attempt to consume `size` number of records. This only comes into play if the initial consume could not get a full slice.                                                                                                                                                                                      |
|         **offset_reset**          | `"smallest"`, `"earliest"`, `"beginning"`, `"largest"`, `"latest"`, `"error"` | `"smallest"` |                                                                                                                                                                                                           How offset resets should be handled when there are no valid offsets for the consumer group.                                                                                                                                                                                                            |
| **partition_assignment_strategy** |                        `"range"`, `"roundrobin"`, `""`                        |      -       |                                                                                                                                                                                                   Name of partition assignment strategy to use when elected group leader assigns partitions to group members.                                                                                                                                                                                                    |
|      **rollback_on_failure**      |                                   `Boolean`                                   |   `false`    |                                                             Controls whether the consumer state is rolled back on failure. This will protect against data loss, however this can have an unintended side effect of blocking the job from moving if failures are minor and persistent. **NOTE:** This currently defaults to `false` due to the side effects of the behavior, at some point in the future it is expected this will default to `true`.                                                              |
|             **size**              |                                   `Number`                                    |   `10000`    |                                                                                                                                                                                                                         How many records to read before a slice is considered complete.                                                                                                                                                                                                                          |
|             **topic**             |                                   `String`                                    |      -       |                                                                                                                                                                                                                                        Name of the Kafka topic to process                                                                                                                                                                                                                                        |
|             **wait**              |                                   `Number`                                    |   `30000`    |                                                                                                                                                                                                              How long to wait for a full chunk of data to be available. Specified in milliseconds.                                                                                                                                                                                                               |

**Example Job Config:**

```js
{
    // the kafka reader only supports one slicer
    "slicers": 1,
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.1.3"
    "assets": [ "kafka" ],
    // ...
    "operations": [
        // kafka reader must be the first item in the operations list
        {
            "_op": "kafka_reader",
            // the kafka topic to subscribe to
            "topic": "d9c7ba7..."
            // the kafka consumer group
            "group": "4e69b5271-4a6...",
            // collect 10000 records before resolving the slice
            "size": 10000
        },
        // Make sure to add additional processors
    ]
    // ...
}
```

### Kafka Sender

> Write data to a specific kafka topic

**Name:** `kafka_sender`

**Type:** `Processor`

**Configuration:**

|               Field               |                         Type                         |   Default   |                                                                                                                                                                                                                                                   Description                                                                                                                                                                                                                                                    |
| :-------------------------------: | :--------------------------------------------------: | :---------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|      **_dead_letter_action**      |                       `String`                       |  `"none"`   | This action will specify what to do when failing to parse or transform a record. ​​​​​<br>​​​​​The following builtin actions are supported: ​​​<br>​​​​​  - "throw": throw the original error ​​​​​<br>​​​​​  - "log": log the error and the data ​​​​​<br>​​​​​  - "none": (default) skip the error entirely<br><br>​​​​​If none of the actions are specified it will try and use a registered Dead Letter Queue API under that name.<br>The API must be already be created by a operation before it can used.​ |
|           **_encoding**           |                       `"json"`                       |  `"json"`   |                                                                                                                                                                                                        Used for specifying the data encoding type when using `DataEntity.fromBuffer`. Defaults to `json`.                                                                                                                                                                                                        |
|              **_op**              |                       `String`                       |      -      |                                                                                                                                                                                                                       Name of operation, , it must reflect the name of the file or folder                                                                                                                                                                                                                        |
|          **compression**          | `"none"`, `"gzip"`, `"snappy"`, `"lz4"`, `"inherit"` |  `"gzip"`   |                                                                                                                                                                                                                                            Type of compression to use                                                                                                                                                                                                                                            |
|          **connection**           |                       `String`                       | `"default"` |                                                                                                                                                                                                                                      The Kafka producer connection to use.                                                                                                                                                                                                                                       |
|           **id_field**            |                       `String`                       |      -      |                                                                                                                                                                                                                                 Field in the incoming record that contains keys                                                                                                                                                                                                                                  |
|       **metadata_refresh**        |                       `Number`                       |  `300000`   |                                                                                                                                                                                                       How often the producer will poll the broker for metadata information. Set to -1 to disable polling.                                                                                                                                                                                                        |
| **partition_assignment_strategy** |           `"range"`, `"roundrobin"`, `""`            |      -      |                                                                                                                                                                                                   Name of partition assignment strategy to use when elected group leader assigns partitions to group members.                                                                                                                                                                                                    |
|             **size**              |                       `Number`                       |   `10000`   |                                                                                                                                                                                                                          How many messages will be batched and sent to kafka together.                                                                                                                                                                                                                           |
|        **timestamp_field**        |                       `String`                       |      -      |                                                                                                                                                                                                                   Field in the incoming record that contains a timestamp to set on the record                                                                                                                                                                                                                    |
|         **timestamp_now**         |                      `Boolean`                       |   `false`   |                                                                                                                                                                                                                   Set to true to have a timestamp generated as records are added to the topic                                                                                                                                                                                                                    |
|             **topic**             |                       `String`                       |      -      |                                                                                                                                                                                                                                     Name of the Kafka topic to send data to                                                                                                                                                                                                                                      |
|             **wait**              |                       `Number`                       |    `20`     |                                                                                                                                                                                                                    How long to wait for `size` messages to become available on the producer.                                                                                                                                                                                                                     |

**Example Job Config:**

```js
{
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.1.3"
    "assets": [ "kafka" ],
    // ...
    "operations": [
        // ...
        // The kafka sender cannot be the first operation in the list
        // since it is not a reader
        {
            "_op": "kafka_sender",
            // the kafka topic to subscribe to
            "topic": "d9c7ba7..."
            // produce 10000 records at a time
            "size": 10000
        }
    ]
    // ...
}
```

## Development

### Tests

Run the kafka tests

**Requirements:**

- `kafka` - A running instance of kafka

**Environment:**

- `KAFKA_BROKERS` - Defaults to `localhost:9091`

```bash
yarn test
```

### Build

Build a compiled asset bundle to deploy to a teraslice cluster.

**Install Teraslice CLI**

```bash
yarn global add teraslice-cli
```

```bash
teraslice-cli assets build
```

### Documentation

To update the documentation run the following command.

```bash
./scripts/doc-generator.js
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](./LICENSE) licensed.
