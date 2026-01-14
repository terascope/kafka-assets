# kafka_reader_api

This is a [teraslice api](https://terascope.github.io/teraslice/docs/jobs/configuration#apis), which provides an API to read messages from a Kafka topic and can be utilized by any processor, reader or slicer.

The `kafka_reader_api` will provide an [api factory](https://terascope.github.io/teraslice/docs/packages/job-components/api/operations/api-factory/overview), which is a singleton that can create, cache and manage multiple kafka readers that can be accessed in any operation through the `getAPI` method on the operation.

This is a high throughput operation. This reader handles all the complexity of balancing writes across partitions and managing ever-changing brokers.

This uses [@confluentinc/kafka-javascript](https://github.com/confluentinc/kafka-javascript) (librdkafka) underneath the hood.

For this reader to function properly, you will need a running kafka cluster and configure this job with the correct group, topic and partition management options.

This is a [recoverable](https://terascope.github.io/teraslice/docs/management-apis/endpoints-json#post-v1jobsjobid_recover) reader, meaning that this job can be stopped, and then pick back up where it left off.

Fetched records will already have metadata associated with it. Please reference the [metadata section](#metadata) for more information.

## Usage

### Example Processor using a kafka reader API

This is an example of a custom fetcher using the kafka_reader_api to make its own consumers to kafka.

Example job

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
            "_op" : "some_reader",
            "_api_name" : "kafka_reader_api"
        },
        {
            "_op": "noop"
        }
    ]
}
```

Here is a custom fetcher for the job described above

```javascript
// found at  /some_reader/fetcher.ts
export default class SomeReader extends Fetcher {

    async initialize() {
        await super.initialize();
        const apiName = this.opConfig._api_name;
        const apiManager = this.getAPI(apiName);
        this.api = await apiManager.create(apiName, {});
    }

    async fetch(slice) {
        return this.api.consume({ size: slice.size, wait: this.opConfig.wait });
    }
}
```

## Kafka Reader Factory API Methods

### size

this will return how many separate reader apis are in the cache

### get

parameters:

- name: String

this will fetch any reader api that is associated with the name provided

### getConfig

parameters:

- name: String

this will fetch any reader api config that is associated with the name provided

### create (async)

parameters:

- name: String
- configOverrides: Check options below, optional

This will create an instance of a reader api and cache it with the name given. Any config provided in the second argument will override what is specified in the apiConfig and cache it with the name provided. It will throw an error if you try creating another api with the same name parameter

### remove (async)

parameters:

- name: String

This will remove an instance of a reader api from the cache and will follow any cleanup specified in the api code.

### entries

This will allow you to iterate over the cache name and client of the cache

### keys

This will allow you to iterate over the cache name of the cache

### values

This will allow you to iterate over the values of the cache

## Example of using the factory methods in a processor

```typescript
// example of api configuration
const apiConfig = {
    _name: 'kafka_reader_api',
    topic: 'kafka-test-fetcher',
    group: '58b1bc77-d950-4e89-a3e1-4e93ad3e6cec',
    size: 10000,
    wait: 8000,
    rollback_on_failure: true,
    _dead_letter_action: 'log'
};


const apiManager = this.getAPI<ElasticReaderFactoryAPI>(apiName);

apiManager.size() === 0

// this will return an api cached at "normalClient" and it will use the default api config
const normalClient = await apiManager.create('normalClient', {})

apiManager.size() === 1

apiManager.get('normalClient') === normalClient

// this will return an api cached at "overrideClient" and it will use the api config but override the topic to "other_topic" in the new instance.
const overrideClient = await apiManager.create('overrideClient', { topic: 'other_topic', _connection: "other" })

apiManager.size() === 2

// this will return the full configuration for this client
apiManger.getConfig('overrideClient') === {
    _name: "kafka_reader_api",
    topic: 'other_topic',
    group: '58b1bc77-d950-4e89-a3e1-4e93ad3e6cec',
    size: 10000,
    wait: 8000,
    rollback_on_failure: true,
    _dead_letter_action: 'log',
    _connection: "other"
}


await apiManger.remove('normalClient');

apiManager.size() === 1

apiManager.get('normalClient') === undefined

```

## Kafka Reader Instance

This is the reader class that is returned from the create method of the APIFactory. This returns an kafka consumer.

### consume

```(query: { size: number; wait: number }) => Promise<DataEntities[]>```
parameters:

- query: an object with size (number of records to fetch) and wait (time in milliseconds to finish slice)

```js
const query: {
    size: 10000,
    wait: 8000
};

const results = await api.consume(query)
```

## Parameters

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| \_op| Name of operation, it must reflect the exact name of the file | String | required |
| topic | Name of the Kafka topic to process | String | required |
| group | Name of the Kafka consumer group | String | required |
| size | How many records to read before a slice is considered complete. | Number | optional, defaults to `10000` |
| _connection | Name of the kafka connection to use when reading data | String | optional, defaults to the 'default' connection in the kafka terafoundation connector config |
| max_poll_interval | The maximum delay between invocations of poll() when using consumer group management. This places an upper bound on the amount of time that the consumer can be idle before fetching more records. If poll() is not called before expiration of this timeout, then the consumer is considered failed and the group will rebalance in order to reassign the partitions to another member| String/Duration | optional, defaults to `"5 minutes"` |
| offset_reset |  How offset resets should be handled when there are no valid offsets for the consumer group. May be set to `smallest`, `earliest`, `beginning`, `largest`, `latest` or `error` | String | optional, defaults to `smallest` |
| partition_assignment_strategy |  Name of partition assignment strategy to use when elected group leader assigns partitions to group members. May be set to `range`, `roundrobin`, `cooperative-sticky` or `""` | String | optional, defaults to `""` |
| rollback_on_failure | Controls whether the consumer state is rolled back on failure. This will protect against data loss, however this can have an unintended side effect of blocking the job from moving if failures are minor and persistent. NOTE: This currently defaults to false due to the side effects of the behavior, at some point in the future it is expected this will default to true.| Boolean | optional, defaults to `false` |
| use_commit_sync | Use commit sync instead of async (usually not recommended) | Boolean | optional, defaults to `false` |
| wait |How long to wait for a full chunk of data to be available. Specified in milliseconds if you use a number. | String/Duration/Number | optional, defaults to `30 seconds` |
| _encoding | Used for specifying the data encoding type when using DataEntity.fromBuffer. May be set to `json` or `raw` | String | optional, defaults to `json` |
| rdkafka_options | [librdkafka defined settings](https://github.com/confluentinc/librdkafka/blob/master/CONFIGURATION.md) that are not subscription specific. **Settings here will override other settings.** See [Configuration Hierarchy](../../packages/terafoundation_kafka_connector/overview.md#configuration-hierarchy) for details on how settings are prioritized. | Object | optional, default to `{}` |

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
