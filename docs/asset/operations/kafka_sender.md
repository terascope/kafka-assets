# kafka_sender

The kafka_sender is used to send data to a kafka topic. This is a high throughput operation.

This uses [@confluentinc/kafka-javascript](https://github.com/confluentinc/kafka-javascript) (librdkafka) underneath the hood.

For this sender to function properly, you will need a running kafka cluster and configure this job with the correct topic and producer configurations.

## Usage

### Send data to topic, use key and time from fields on record

In this example, the kafka_sender will send data to the kafka-test-sender topic using the uuid field of the record. It will also annotate the kafka record timestamp metadata with the date specified on the created field on the record.

**Important:** The `kafka_sender` operation requires a `kafka_sender_api` to be defined in the job. All configuration settings (topic, size, compression, etc.) must be specified on the API.

Example job

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
            "_name": "kafka_sender_api",
            "topic": "kafka-test-sender",
            "id_field": "uuid",
            "timestamp_field": "created",
            "compression": "gzip",
            "size": 10000,
            "wait": 8000
        }
    ],
    "operations": [
        {
            "_op": "test-reader"
        },
        {
            "_op": "kafka_sender",
            "_api_name": "kafka_sender_api"
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

In this example, the kafka_sender will send data to the kafka-test-sender topic using the _key metadata value, which happens when the `id_field` is not set. It will also annotate the kafka record timestamp metadata with a new date at processing time.

Example job

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
            "_name": "kafka_sender_api",
            "topic": "kafka-test-sender",
            "timestamp_now": true,
            "compression": "lz4",
            "size": 10000,
            "wait": 8000
        }
    ],
    "operations": [
        {
            "_op": "test-reader"
        },
        {
            "_op": "kafka_sender",
            "_api_name": "kafka_sender_api"
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
            "_name": "kafka_sender_api",
            "topic": "kafka-test-sender",
            "id_field": "uuid",
            "compression": "gzip",
            "size": 10000,
            "wait": 8000,
            "rdkafka_options": {
                "queue.buffering.max.ms": 100,
                "batch.num.messages": 10000,
                "message.send.max.retries": 3,
                "retry.backoff.ms": 200
            }
        }
    ],
    "operations": [
        {
            "_op": "test-reader"
        },
        {
            "_op": "kafka_sender",
            "_api_name": "kafka_sender_api"
        }
    ]
}
```

In this example, `rdkafka_options` on the API configures the producer to:
- Buffer messages for up to 100ms before sending (`queue.buffering.max.ms`)
- Batch up to 10000 messages together (`batch.num.messages`)
- Retry failed sends up to 3 times (`message.send.max.retries`)
- Wait 200ms between retries (`retry.backoff.ms`)

## Parameters

### Operation Parameters

The `kafka_sender` operation has minimal configuration. All Kafka-related settings must be configured on the [kafka_sender_api](../apis/kafka_sender_api.md).

| Configuration | Description | Type | Notes |
| --------- | -------- | ------ | ------ |
| \_op | Name of operation, it must reflect the exact name of the file | String | required |
| \_api_name | Name of the `kafka_sender_api` to use | String | **required** |

### API Parameters

All Kafka configuration must be specified on the `kafka_sender_api`. See the [kafka_sender_api documentation](../apis/kafka_sender_api.md#parameters) for the full list of available parameters including:

- `topic` - Name of the Kafka topic to send records (required)
- `size` - How many messages will be batched together (default: 10000)
- `id_field` - Field in the record to use for partition assignment (optional)
- `timestamp_field` - Field containing timestamp for the record (optional)
- `timestamp_now` - Generate timestamp at processing time (default: false)
- `compression` - Type of compression to use (default: 'gzip')
- `wait` - How long to wait for size messages (default: 500)
- `rdkafka_options` - Advanced librdkafka settings (default: {})
- And more...
