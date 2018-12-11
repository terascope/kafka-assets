# Kafka Asset Bundle

[![Build Status](https://travis-ci.org/terascope/kafka-assets.svg?branch=master)](https://travis-ci.org/terascope/kafka-assets)
[![codecov](https://codecov.io/gh/terascope/kafka-assets/branch/master/graph/badge.svg)](https://codecov.io/gh/terascope/kafka-assets)

A bundle of [Kafka](https://kafka.apache.org/) operations and processors for [Teraslice](https://github.com/terascope/teraslice).

    

This asset bundle requires a running Teraslice cluster, you can find the documentation [here](https://github.com/terascope/teraslice/blob/master/README.md).

- [Installation](#installation)
- [Releases](#releases)
- [Operations](#operations)
  - [Kafka Reader](#kafka-reader)
  - [Kafka Sender](#kafka-sender)
- [Development](#development)
  - [Tests](#tests)
  - [Build](#build)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# Step 1: make sure you have teraslice-cli installed
yarn global add teraslice-cli
# Step 2:
# FIXME: this should be accurate
teraslice-cli asset deploy ...
```

## Releases

You can find a list of releases, changes, and pre-built asset bundles [here](https://github.com/terascope/kafka-assets/releases).

## Operations

### Kafka Reader

Read data in chunks from a kafka topic


**Name:** `kafka_reader`

**Type:** Reader

**Configuration:**
| Field               | Type                                                              | Default    | Description                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| topic               | required_String                                                   | none       | Name of the Kafka topic to process                                                                                                                                                                                                                                                                                                                                                      |
| group               | required_String                                                   | none       | Name of the Kafka consumer group                                                                                                                                                                                                                                                                                                                                                        |
| offset_reset        | "smallest", "earliest", "beginning", "largest", "latest", "error" | "smallest" | How offset resets should be handled when there are no valid offsets for the consumer group.                                                                                                                                                                                                                                                                                             |
| size                | Number                                                            | 10000      | How many records to read before a slice is considered complete.                                                                                                                                                                                                                                                                                                                         |
| wait                | Number                                                            | 30000      | How long to wait for a full chunk of data to be available. Specified in milliseconds.                                                                                                                                                                                                                                                                                                   |
| interval            | Number                                                            | 50         | How often to attempt to consume `size` number of records. This only comes into play if the initial consume could not get a full slice.                                                                                                                                                                                                                                                  |
| connection          | required_String                                                   | "default"  | The Kafka consumer connection to use.                                                                                                                                                                                                                                                                                                                                                   |
| rollback_on_failure | Boolean                                                           | false      | Controls whether the consumer state is rolled back on failure. This will protect against data loss, however this can have an unintended side effect of blocking the job from moving if failures are minor and persistent. **NOTE:** This currently defaults to `false` due to the side effects of the behavior, at some point in the future it is expected this will default to `true`. |
| bad_record_action   | "none", "throw", "log"                                            | "none"     | How to handle bad records, defaults to doing nothing                                                                                                                                                                                                                                                                                                                                    |

**Example Job Config:**

```js
{
    // the kafka reader only supports one slicer
    "slicers": 1,
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.0.0"
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

Write data to a specific kafka topic


**Name:** `kafka_sender`

**Type:** Processor

**Configuration:**
| Field            | Type                                       | Default   | Description                                                                                         |
| ---------------- | ------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------- |
| topic            | required_String                            | none      | Name of the Kafka topic to send data to                                                             |
| id_field         | String                                     | none      | Field in the incoming record that contains keys                                                     |
| timestamp_field  | String                                     | none      | Field in the incoming record that contains a timestamp to set on the record                         |
| timestamp_now    | Boolean                                    | false     | Set to true to have a timestamp generated as records are added to the topic                         |
| connection       | String                                     | "default" | The Kafka producer connection to use.                                                               |
| compression      | "none", "gzip", "snappy", "lz4", "inherit" | "gzip"    | Type of compression to use                                                                          |
| wait             | Number                                     | 20        | How long to wait for `size` messages to become available on the producer.                           |
| size             | Number                                     | 10000     | How many messages will be batched and sent to kafka together.                                       |
| metadata_refresh | Number                                     | 300000    | How often the producer will poll the broker for metadata information. Set to -1 to disable polling. |

**Example Job Config:**

```js
{
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.0.0"
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

```bash
./scripts/build.sh
```


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](./LICENSE) licensed.