# kafka_sender

The kafka_sender is used to send data to a kafka topic. This is a high throughput operation.

This uses [node-rdkafka](https://github.com/Blizzard/node-rdkafka) underneath the hood.

For this sender to function properly, you will need a running kafka cluster and configure this job with the correct topic and producer configurations.

## Usage

### Send data to topic, use key and time from fields on record

In this example, the kafka_sender will send data to the kafka-test-sender topic using the uuid field of the record. It will also annotate the kafka record timestamp metadata with the date specified on the created field on the record.

Example job

```json
{
    "name": "test-job",
    "lifecycle": "once",
    "max_retries": 3,
    "slicers": 1,
    "workers": 10,
    "assets": ["kafka"],
    "operations": [
        {
            "_op":"test-reader"
        },
        {
            "_op": "kafka_sender",
            "topic": "kafka-test-sender",
            "id_field": "uuid",
            "timestamp_field": "created",
            "compression": "gzip",
            "timestamp_field": "created",
            "size": 10000,
            "wait": 8000
        }
    ]
}
```

Below is a representation of how the job will execute with the job listed above.

```javascript

const data = [
    {
        "ip" : "120.67.248.156",
        "url" : "http://lucious.biz",
        "uuid" : "a23a8550-0081-453f-9e80-93a90782a5bd",
        "created" : "2019-04-26T08:00:23.225-07:00",
        "ipv6" : "9e79:7798:585a:b847:f1c4:81eb:0c3d:7eb8",
        "location" : "50.15003, -94.89355",
        "bytes" : 124
    }
];

const results = await processor.run(data);

// in senders we return original data so other processors can run
results === data;

// data is compressed using gzip and sent to topic kafka-test-sender
// it uses uuid for its kafka key metadata value
// it uses the value at "created" as the kafka timestamp metadata value
```

### Send data to topic, use _key metadata and create its own timestamp

In this example, the kafka_sender will send data to the kafka-test-sender topic using the_key metadata value, which happens when the `id_field` is not set. It will also annotate the kafka record timestamp metadata with a new date at processing time.

Example job

```json
{
    "name": "test-job",
    "lifecycle": "once",
    "max_retries": 3,
    "slicers": 1,
    "workers": 10,
    "assets": ["kafka"],
    "operations": [
        {
            "_op":"test-reader"
        },
        {
            "_op": "kafka_sender",
            "topic": "kafka-test-sender",
            "timestamp_now": true,
            "compression": "lz4",
            "timestamp_field": "created",
            "size": 10000,
            "wait": 8000
        }
    ]
}
```

Below is a representation of how the job will execute with the job listed above.

```javascript

const data = [
    DataEntity.make({
        "ip" : "120.67.248.156",
        "url" : "http://lucious.biz",
        "uuid" : "a23a8550-0081-453f-9e80-93a90782a5bd",
        "created" : "2019-04-26T08:00:23.225-07:00",
        "ipv6" : "9e79:7798:585a:b847:f1c4:81eb:0c3d:7eb8",
        "location" : "50.15003, -94.89355",
        "bytes" : 124
    }, { _key: 123456789 })
];

const results = await processor.run(data);

// in senders we return original data so other processors can run
results === data;

// data is compressed using lz4 and sent to topic kafka-test-sender
// it uses the _key metadata value 123456789 for its kafka key metadata value
// it uses Date.now() (server time, number of milliseconds elapsed since January 1, 1970 00:00:00 UTC.) as the kafka timestamp metadata value
```

## Parameters

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| \_op| Name of operation, it must reflect the exact name of the file | String | required |
| topic | Name of the Kafka topic to send records | String | required, though if the [kafka_sender_api](../apis/kafka_sender_api.md) is specified then `topic` must be specified on the api and not on the opConfig, please check the [API usage](#api-usage) section |
| size | How many messages will be batched and sent to kafka together. | Number | optional, defaults to `10000` |
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
| _dead_letter_action | action will specify what to do when failing to parse or transform a record. It may be set to `throw`, `log` or `none`. If none of the actions are specified it will try and use a registered Dead Letter Queue API under that name.The API must be already be created by a operation before it can used. | String | optional, defaults to `throw` |

### API usage

In kafka_assets v3, many core components were made into teraslice apis. When you use an kafka processor it will automatically setup the api for you, but if you manually specify the api, then there are restrictions on what configurations you can put on the operation so that clashing of configurations are minimized. The api configs take precedence.

If submitting the job in long form, here is a list of parameters that will throw an error if also specified on the opConfig, since these values should be placed on the api:

- `topic`

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
            "_op":"test-reader"
        },
        {
            "_op": "kafka_sender",
            "topic": "kafka-test-sender",
            "id_field": "uuid",
            "id_field": "uuid",
            "compression": "gzip",
            "timestamp_field": "created",
            "size": 10000,
            "wait": 8000
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
            "_name": "kafka_sender_api",
            "topic": "kafka-test-sender",
            "id_field": "uuid",
            "size": 10000,
            "wait": 8000,
            "_dead_letter_action": "log"
        }
    ],
    "operations" : [
        {
            "_op":"test-reader"
        },
        {
            "_op" : "kafka_sender",
            "api_name" : "kafka_sender_api"
        }
    ]
}
```
