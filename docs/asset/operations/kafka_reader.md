# kafka_reader

The kafka_reader is used to read data from a kafka cluster. This is a high throughput operation. This reader handles all the complexity of balancing writes across partitions and managing ever-changing brokers.

This uses [node-rdkafka](https://github.com/Blizzard/node-rdkafka) underneath the hood.

For this reader to function properly, you will need a running kafka cluster and configure this job with the correct group, topic and partition management options

this is a [recoverable](https://terascope.github.io/teraslice/docs/management-apis/endpoints-json#post-v1jobsjobid_recover) reader, meaning that this job can be stopped, and then pick back up where it left off.

Fetched records will already have metadata associated with it. Please reference the [metadata section](#metadata) for more information.

## Usage

### Read from topic, log records that cannot be processed

In this example, the reader will read from the specified topic with that group id. It will try to collect 10k records or wait 8 seconds, whatever happens first and return that as a completed slice. Since `_dead_letter_action` is set to log, it will log any records that it could not process. If there is an error, it will try to rollback to the correct offset to try again. This job will try to create 40 workers and auto split the partitions between all the workers.

**Important:** The `kafka_reader` operation requires a `kafka_reader_api` to be defined in the job. All configuration settings (topic, group, size, wait, etc.) must be specified on the API.

Example job

```json
{
    "name": "test-job",
    "lifecycle": "once",
    "max_retries": 3,
    "slicers": 1,
    "workers": 40,
    "assets": ["kafka"],
    "apis": [
        {
            "_name": "kafka_reader_api",
            "topic": "kafka-test-fetcher",
            "group": "58b1bc77-d950-4e89-a3e1-4e93ad3e6cec",
            "size": 10000,
            "wait": 8000,
            "rollback_on_failure": true,
            "_dead_letter_action": "log"
        }
    ],
    "operations": [
        {
            "_op": "kafka_reader",
            "_api_name": "kafka_reader_api"
        },
        {
            "_op": "noop"
        }
    ]
}
```

Below is a representation of how the job will execute with the job listed above.

```javascript

// for brevity this is an array of 10k records in the topic
const tenKData = [{ some: 'data' }];

const results = await fetcher.run();

results.length === 10000;

// for brevity this is an array of 5k records left in topic after offset is moved, with bad data
const fiveKData = [{ some: 'data' }, { asdofipuaower.jvcx983r,mn0 }];

const results = await fetcher.run();

// Record { asdofipuaower.jvcx983r,mn0 } is logged because it is not processable

// this will wait 8000 milliseconds before returning records

results.length === 5000;

```

### Using rdkafka_options for advanced configuration

You can use `rdkafka_options` on the API to pass [librdkafka configuration options](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md) directly to the underlying Kafka client. These settings have the highest priority and will override other configuration settings. See [Configuration Hierarchy](../../packages/terafoundation_kafka_connector/overview.md#configuration-hierarchy) for more details.

Example job with rdkafka_options

```json
{
    "name": "test-job",
    "lifecycle": "once",
    "max_retries": 3,
    "slicers": 1,
    "workers": 10,
    "assets": ["kafka"],
    "apis": [
        {
            "_name": "kafka_reader_api",
            "topic": "kafka-test-fetcher",
            "group": "my-consumer-group",
            "size": 10000,
            "wait": 8000,
            "rdkafka_options": {
                "fetch.min.bytes": 100000,
                "fetch.wait.max.ms": 500,
                "session.timeout.ms": 30000,
                "heartbeat.interval.ms": 10000
            }
        }
    ],
    "operations": [
        {
            "_op": "kafka_reader",
            "_api_name": "kafka_reader_api"
        },
        {
            "_op": "noop"
        }
    ]
}
```

In this example, `rdkafka_options` on the API configures the consumer to:
- Wait for at least 100KB of data before returning from a fetch (`fetch.min.bytes`)
- Wait up to 500ms for data to accumulate (`fetch.wait.max.ms`)
- Set session timeout to 30 seconds (`session.timeout.ms`)
- Send heartbeats every 10 seconds (`heartbeat.interval.ms`)

## Parameters

### Operation Parameters

The `kafka_reader` operation has minimal configuration. All Kafka-related settings must be configured on the [kafka_reader_api](../apis/kafka_reader_api.md).

| Configuration | Description | Type | Notes |
| --------- | -------- | ------ | ------ |
| \_op | Name of operation, it must reflect the exact name of the file | String | required |
| \_api_name | Name of the `kafka_reader_api` to use | String | **required** |

### API Parameters

All Kafka configuration must be specified on the `kafka_reader_api`. See the [kafka_reader_api documentation](../apis/kafka_reader_api.md#parameters) for the full list of available parameters including:

- `topic` - Name of the Kafka topic to process (required)
- `group` - Name of the Kafka consumer group (required)
- `size` - How many records to read before a slice is considered complete (default: 10000)
- `wait` - How long to wait for a full chunk of data (default: '30 seconds')
- `offset_reset` - How offset resets should be handled (default: 'smallest')
- `rollback_on_failure` - Whether to rollback on failure (default: false)
- `rdkafka_options` - Advanced librdkafka settings (default: {})
- And more...

### Metadata

When the records are fetched from kafka, metadata will be attached
to each record

- `_key` is set to the kafka message _key
- `_processTime` is set to a a number representing the milliseconds elapsed since the UNIX epoch of when it was first fetched
- `_ingestTime` is set to a a number representing the milliseconds elapsed since the UNIX epoch of the `timestamp` field of the kafka record or when it was first fetched
- `_eventTime`  is set to a a number representing the milliseconds elapsed since the UNIX epoch of when it was first fetched
- `topic` is set from the topic it was from
- `partition` is set from the partition it was from
- `offset` is set to the records offset
- `size` the message size in bytes

Example of metadata from a fetched record

```javascript
// example record in kafka
{
  "ip" : "120.67.248.156",
  "url" : "http://lucious.biz",
  "uuid" : "a23a8550-0081-453f-9e80-93a90782a5bd",
  "created" : "2019-04-26T08:00:23.225-07:00",
  "ipv6" : "9e79:7798:585a:b847:f1c4:81eb:0c3d:7eb8",
  "location" : "50.15003, -94.89355",
  "bytes" : 124
}

const expectedResults = {
    "ip" : "120.67.248.156",
    "url" : "http://lucious.biz",
    "uuid" : "a23a8550-0081-453f-9e80-93a90782a5bd",
    "created" : "2019-04-26T08:00:23.225-07:00",
    "ipv6" : "9e79:7798:585a:b847:f1c4:81eb:0c3d:7eb8",
    "location" : "50.15003, -94.89355",
    "bytes" : 124
};

DataEntity.isDataEntity(expectedResults) === true;

expectedResults.getMetadata() === {
    _key: "ltyRQW4B8WLke7PkER8L", // the kafka message key
    topic:  "kafka-test-fetcher",
    partition: 0,
    offset: 185,
    size: 193,
    _processTime: 1596663162372,
    _ingestTime: 1596663162372,
    _eventTime: 1596663162372,
}
```
