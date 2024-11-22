# kafka_reader
The kafka_reader is used to read data from a kafka cluster. This is a high throughput operation. This reader handles all the complexity of balancing writes across partitions and managing ever-changing brokers.

This uses [node-rdkafka](https://github.com/Blizzard/node-rdkafka) underneath the hood.

For this reader to function properly, you will need a running kafka cluster and configure this job with the correct group, topic and partition management options

this is a [recoverable](https://terascope.github.io/teraslice/docs/management-apis/endpoints-json#post-v1jobsjobid_recover) reader, meaning that this job can be stopped, and then pick back up where it left off.

Fetched records will already have metadata associated with it. Please reference the [metadata section](#metadata) for more information.

## Usage

### Read from topic, log records that cannot be processed
In this example, the reader will read from the specified topic with that group id. It will try to collect 10k records or wait 8 seconds, whatever happens first and return that as a completed slice. Since `_dead_letter_action` is set to log, it will log any records that it could not process. If there is an error, it will try to rollback to the correct offset to try again. This job will try to create 40 workers and auto split the partitions between all the workers.

Example job
```json
{
    "name": "test-job",
    "lifecycle": "once",
    "max_retries": 3,
    "slicers": 1,
    "workers": 40,
    "assets": ["kafka"],
    "operations":[
        {
            "_op": "kafka_reader",
            "topic": "kafka-test-fetcher",
            "group": "58b1bc77-d950-4e89-a3e1-4e93ad3e6cec",
            "size": 10000,
            "wait": 8000,
            "rollback_on_failure": true,
            "_dead_letter_action": "log"
        },
        {
            "_op":"noop"
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

## Parameters

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| \_op| Name of operation, it must reflect the exact name of the file | String | required |
| topic | Name of the Kafka topic to process | String | required, though if the [kafka_reader_api](../apis/kafka_reader_api.md) is specified then `topic` must be specified on the api and not on the opConfig, please check the [API usage](#api-usage) section |
| group | Name of the Kafka consumer group | String | required, though if the [kafka_reader_api](../apis/kafka_reader_api.md) is specified then `group` must be specified on the api and not on the opConfig, please check the [API usage](#api-usage) section |
| size | How many records to read before a slice is considered complete. | Number | optional, defaults to `10000` |
| connection | Name of the kafka connection to use when sending data | String | optional, defaults to the 'default' connection in the kafka terafoundation connector config |
| max_poll_interval | The maximum delay between invocations of poll() when using consumer group management. This places an upper bound on the amount of time that the consumer can be idle before fetching more records. If poll() is not called before expiration of this timeout, then the consumer is considered failed and the group will rebalance in order to reassign the partitions to another member| String/Duration | optional, defaults to `"5 minutes"` |
| offset_reset |  How offset resets should be handled when there are no valid offsets for the consumer group. May be set to `smallest`, `earliest`, `beginning`, `largest`, `latest` or `error` | String | optional, defaults to `smallest` |
| partition_assignment_strategy |  Name of partition assignment strategy to use when elected group leader assigns partitions to group members. May be set to `range`, `roundrobin`, `cooperative-sticky` or `""` | String | optional, defaults to `""` |
| rollback_on_failure | Controls whether the consumer state is rolled back on failure. This will protect against data loss, however this can have an unintended side effect of blocking the job from moving if failures are minor and persistent. NOTE: This currently defaults to false due to the side effects of the behavior, at some point in the future it is expected this will default to true.| Boolean | optional, defaults to `false` |
| use_commit_sync | Use commit sync instead of async (usually not recommended) | Boolean | optional, defaults to `false` |
| wait | How long to wait for a full chunk of data to be available. Specified in milliseconds if you use a number. | String/Duration/Number | optional, defaults to `30 seconds` |
| api_name | Name of `kafka_reader_api` used for the reader, if none is provided, then one is made and assigned the name to `kafka_reader_api`, and is injected into the execution | String | optional, defaults to `kafka_reader_api` |
| _encoding | Used for specifying the data encoding type when using DataEntity.fromBuffer. May be set to `json` or `raw` | String | optional, defaults to `json` |
| _dead_letter_action | action will specify what to do when failing to parse or transform a record. It may be set to `throw`, `log` or `none`. If none of the actions are specified it will try and use a registered Dead Letter Queue API under that name.The API must be already be created by a operation before it can used. | String | optional, defaults to `throw` |


#### API usage
In kafka_assets v3, many core components were made into teraslice apis. When you use an kafka processor it will automatically setup the api for you, but if you manually specify the api, then there are restrictions on what configurations you can put on the operation so that clashing of configurations are minimized. The api configs take precedence.

If submitting the job in long form, here is a list of parameters that will throw an error if also specified on the opConfig, since these values should be placed on the api:
- `topic`
- `group`


`SHORT FORM (no api specified)`
```json
{
    "name": "test-job",
    "lifecycle": "once",
    "max_retries": 3,
    "slicers": 1,
    "workers": 40,
    "assets": ["kafka"],
    "operations":[
        {
            "_op": "kafka_reader",
            "topic": "kafka-test-fetcher",
            "group": "58b1bc77-d950-4e89-a3e1-4e93ad3e6cec",
            "size": 10000,
            "wait": 8000,
            "rollback_on_failure": true,
            "_dead_letter_action": "log"
        },
        {
            "_op":"noop"
        }
    ]
}
```

this configuration will be expanded out to the long form underneath the hood
`LONG FORM (api is specified)`

```json
{
    "name" : "testing",
    "workers" : 1,
    "slicers" : 1,
    "lifecycle" : "once",
    "assets" : [
        "kafka"
    ],
    "apis" : [
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
    "operations" : [
        {
            "_op" : "kafka_reader",
            "api_name" : "kafka_reader_api"
        },
        {
            "_op": "noop"
        }
    ]
}
```

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
