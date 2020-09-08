# kafka_sender_api
This is a [teraslice api](https://terascope.github.io/teraslice/docs/jobs/configuration#apis), which provides an API to send messages to a Kafka topic and can be utilized by any processor, reader or slicer.

 The `kafka_sender_api` will provide an [api factory](https://terascope.github.io/teraslice/docs/packages/job-components/api/classes/apifactory), which is a singleton that can create, cache and manage multiple kafka senders that can be accessed in any operation through the `getAPI` method on the operation.

This api is the core of the [kafka_sender](../operations/kafka_sender.md). This contains all the same behavior, functionality and configuration of that reader

This is a high throughput operation and uses [node-rdkafka](https://github.com/Blizzard/node-rdkafka) underneath the hood.

For this sender to function properly, you will need a running kafka cluster and configure this job with the correct topic and producer configurations.

## Usage

### Send data to topic, use key and time from fields on record
In this example, the kafka_sender will send data to the kafka-test-sender topic using the uuid field of the record. It will also annotate the kafka record timestamp metadata with the date specified on the created field on the record.

## Usage
### Example Processor using a kafka sender API
This is an example of a custom sender using the kafka_sender_api to ship data to a topic.

Example Job

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
            "_name": "kafka_sender_api",
            "topic": "test_topic",
            "size": 10000,
            "timestamp_field": "created",
            "connection": "default"
        }
    ],
    "operations" : [
        {
            "_op" : "test-reader"
        },
         {
            "_op" : "some_sender",
            "api_name" : "kafka_sender_api"
        }
    ]
}
```
Here is a custom processor for the job described above

```javascript
// located at /some_sender/processor.ts

export default class SomeSender extends BatchProcessor {

    async initialize() {
        await super.initialize();
        const apiManager = this.getAPI(this.opConfig.api_name);
        this.api = await apiManager.create('kafkaSender', {});
        await this.api.verify();
    }

    async onBatch(data) {
        if (data == null || data.length === 0) return data;
        await this.api.send(data);
        // NOTE: its important to return original data so operators afterwards can run
        return data;
    }
}
```

## Kafka Sender Factory API Methods

### size

this will return how many separate sender apis are in the cache

### get
parameters:
- name: String

this will fetch any sender api that is associated with the name provided

### getConfig
parameters:
- name: String

this will fetch any sender api config that is associated with the name provided

### create (async)
parameters:
- name: String
- configOverrides: Check options below, optional

this will create an instance of a [sender api](#kafka_sender_instance), and cache it with the name given. Any config provided in the second argument will override what is specified in the apiConfig and cache it with the name provided. It will throw an error if you try creating another api with the same name parameter

### remove (async)
parameters:
- name: String

this will remove an instance of a sender api from the cache and will follow any cleanup code specified in the api code.

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
    _name: 'kafka_sender_api',
    topic: 'test_topic',
    size: 10000,
    timestamp_field: 'created',
    connection: 'default'
};


const apiManager = this.getAPI<ElasticReaderFactoryAPI>(apiName);

apiManager.size() === 0

// this will return an api cached at "normalClient" and it will use the default api config
const normalClient = await apiManager.create('normalClient', {})

apiManager.size() === 1

apiManager.get('normalClient') === normalClient

// this will return an api cached at "overrideClient" and it will use the api config but override the index to "other_index" in the new instance.
const overrideClient = await apiManager.create('overrideClient', { topic: 'other_topic', connection: "other"})

apiManager.size() === 2

// this will return the full configuration for this client
apiManger.getConfig('overrideClient') === {
    _name: 'kafka_sender_api',
    topic: 'other_topic',
    size: 10000,
    timestamp_field: 'created',
    connection: 'other'
};


await apiManger.remove('normalClient');

apiManager.size() === 1

apiManager.get('normalClient') === undefined

```

## Kafka Sender Instance
This is the sender class that is returned from the create method of the APIFactory. This returns a [sender api](https://terascope.github.io/teraslice/docs/packages/job-components/api/interfaces/routesenderapi), which is a common interface used for sender apis.

### send (async)
```(records: DataEntities[]) => Promise<void>```
This method will compress the records can send them to the kafka topic listed on the configuration

parameters:
- records: an array of data-entities

### verify (async)
```(route?: string) => Promise<void>```
This method ensures that the topic is created and available. It defaults to the topic listed in the apiConfig

parameters:
- route: a string representing the index to create


### Usage of the kafka sender instance
```js
await api.verify();

await api.send([
    DataEntity.make({
        some: 'data',
        name: 'someName',
        job: 'to be awesome!'
    })
]);
```

## Parameters

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| \_op| Name of operation, it must reflect the exact name of the file | String | required |
| topic | Name of the Kafka topic to send records | String | required |
| size | How many messages will be batched and sent to kafka together. | Number | optional, defaults to `10000` |
| id_field | Field in the incoming record that will be used to create the id of the record | String | optional, if not set, it will check for the `_key` metadata value. If nothing is set, then kafka will generate a key for it |
| timestamp_field | Field in the incoming record that contains a timestamp to set on the record | String | optional, it will take precedence over `timestamp_now` if this is set |
| timestamp_now | Set to true to have a timestamp generated as records are added to the topic | Boolean | optional, defaults to `false` |
| compression | Type of compression to use on record sent to topic, may be set to `none`, `gzip`, `snappy`, `lz4` and `inherit` | String | optional, defaults to `gzip` |
| wait | How long to wait for size messages to become available on the producer, in milliseconds. | String/Duration/Number | optional, defaults to `500` |
| connection | Name of the kafka connection to use when sending data | String | optional, defaults to the 'default' connection in the kafka terafoundation connector config |
| required_acks | The number of required broker acknowledgements for a given request, set to -1 for all. | Number | optional, defaults to `1` |
| metadata_refresh | How often the producer will poll the broker for metadata information. Set to -1 to disable polling. | String/Duration/Number | optional, defaults to `"5 minutes"` |
| partition_assignment_strategy |  Name of partition assignment strategy to use when elected group leader assigns partitions to group members. May be set to `range`, `roundrobin` or `""` | String | optional, defaults to `""` |
| api_name | Name of `kafka_sender_api` used for the sender, if none is provided, then one is made and assigned the name to `kafka_sender_api`, and is injected into the execution | String | optional, defaults to `kafka_sender_api`|| _encoding | Used for specifying the data encoding type when using DataEntity.fromBuffer. May be set to `json` or `raw` | String | optional, defaults to `json` |
