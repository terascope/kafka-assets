# kafka_sender_api

The kafka_sender_api is a [teraslice api](https://terascope.github.io/teraslice/docs/jobs/configuration#apis), which provides the functionality to send messages to a kafka topic and can be utilized by any processor, reader or slicer.  It is a high throughput operation that uses [node-rdkafka](https://github.com/Blizzard/node-rdkafka) underneath the hood and is the core of the [kafka_sender](../operations/kafka_sender.md).  It contains the same behavior, functionality, and configuration properties of the kafka_sender.

 The `kafka_sender_api` provides an [api factory](https://terascope.github.io/teraslice/docs/packages/job-components/api/classes/apifactory), which is a [singleton](https://en.wikipedia.org/wiki/Singleton_pattern) that can create, cache and manage multiple kafka senders.  These api functions can then be accessed in any operation through the `getAPI` method.

## Usage

### Example Processor using a kafka sender API

This is an example of a custom sender using the kafka_sender_api to send data to a topic.

Example Job

```json
{
    "name" : "testing",
    "workers" : 1,
    "slicers" : 1,
    "lifecycle" : "persistent",
    "assets" : [
        "kafka"
    ],
    "apis" : [
        {
            "_name": "kafka_sender_api",
            "topic": "test_topic",
            "size": 10000,
            "id_field": "uuid",
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

The custom processor for the job above

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
        // NOTE: it is important to return original data so operators afterwards can run
        return data;
    }
}
```

## Kafka Sender Factory API Methods

### size

Returns the number of separate sender apis in the cache.

### get

parameters:

- name: String

Fetches the sender api associated with the name provided.

### getConfig

parameters:

- name: String

Fetches the sender api config associated with the name provided.

### create (async)

parameters:

- name: String
- configOverrides: Check options below, optional

Creates and caches an instance of a [sender api](#kafka_sender_api). Any config provided in the second argument will override what is specified in the apiConfig. It will throw an error if you try creating another api with the same name.

### remove (async)

parameters:

- name: String

Removes an instance of a sender api from the cache and will follow any cleanup code specified in the api code.

### entries

Iterates over the names and clients in the cache.

### keys

Iterates over the names in the cache

### values

Iterates over the values in the cache

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

// creates and returns an api named "normalClient" which uses the default api config
const normalClient = await apiManager.create('normalClient', {})

apiManager.size() === 1

apiManager.get('normalClient') === normalClient

// creates and returns an api named "overrideClient" which overrides the default configuration's topic setting with "other_topic" and the connection setting with "other"
const overrideClient = await apiManager.create('overrideClient', { topic: 'other_topic', connection: "other"})

apiManager.size() === 2

// returns the configuration for the overrideClient sender api
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

The [sender api](https://terascope.github.io/teraslice/docs/packages/job-components/api/interfaces/routesenderapi) returned from the APIFactory's create method.

### send (async)

```(records: DataEntities[]) => Promise<void>```
Compresses the records and sends them to the kafka topic specified by the topic property.

parameters:

- records: an array of data-entities

### verify (async)

```(route?: string) => Promise<void>```
Ensures that the topic is created and available. It defaults to the topic listed in the apiConfig

parameters:

- route: a string representing the kafka topic to verify

### Usage of the kafka sender instance

```js
const apiManager = this.getAPI<ElasticReaderFactoryAPI>(apiName);

const api = await apiManager.create('client', {})

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
| size | How many messages will be batched and sent to kafka together. | Number | optional, defaults to `10,000` |
| max_buffer_size | Maximum number of messages allowed on the producer queue. A value of 0 disables this limit. | Number | optional, defaults to `100,000` |
| max_buffer_kbytes_size | Maximum total message size sum in kilobytes allowed on the producer queue. | Number | optional, defaults to `1,048,576` |
| id_field | Field in the incoming record that will be used to assign the record to a topic partition. | String | optional, if not set, it will check for the `_key` metadata value. If no key is found the sender uses a round robin method to assign records to partitions.|
| timestamp_field | Field in the incoming record that contains a timestamp to set on the record | String | optional, it will take precedence over `timestamp_now` if this is set |
| timestamp_now | Set to true to have a timestamp generated as records are added to the topic | Boolean | optional, defaults to `false` |
| compression | Type of compression to use on record sent to topic, may be set to `none`, `gzip`, `snappy`, `lz4` and `inherit` | String | optional, defaults to `gzip` |
| wait | How long to wait for size messages to become available on the producer, in milliseconds. | String/Duration/Number | optional, defaults to `500` |
| connection | Name of the kafka connection to use when sending data | String | optional, defaults to the 'default' connection in the kafka terafoundation connector config |
| required_acks | The number of required broker acknowledgements for a given request, set to -1 for all. | Number | optional, defaults to `1` |
| metadata_refresh | How often the producer will poll the broker for metadata information. Set to -1 to disable polling. | String/Duration/Number | optional, defaults to `"5 minutes"` |
| api_name | Name of `kafka_sender_api` used for the sender, if none is provided, then one is made and assigned the name to `kafka_sender_api`, and is injected into the execution | String | optional, defaults to `kafka_sender_api`|
| _encoding | Used for specifying the data encoding type when using DataEntity.fromBuffer. May be set to `json` or `raw` | String | optional, defaults to `json` |
