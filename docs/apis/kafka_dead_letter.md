# kafka_dead_letter
This is a Teraslice [api](https://terascope.github.io/teraslice/docs/jobs/types-of-operations#apis). It extends the [dead letter queue](https://terascope.github.io/teraslice/docs/jobs/dead-letter-queue#docsNav) functionality.

Any record that fails using the `tryRecord` operation api, or any record directly used by the `rejectRecord` operation api will be collected and sent to a kafka topic at the end of a slice.

More specifically it is sent at the `onSliceFinalizing` [operation lifecycle event](https://terascope.github.io/teraslice/docs/packages/job-components/api/interfaces/workeroperationlifecycle).

It is useful to keep a kafka topic of all failed entities to inspect or  reprocess them later on or you could have a job run in parallel processing the queue of failed records.

## Usage

### Use kafka_dead_letter to send failed records to a topic

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
            "_name": "kafka_dead_letter",
            "topic": "failed_record_topic",
            "size": 1000
        }
    ],
    "operations" : [
        {
            "_op" : "test-reader"
        },
        {
            "_op" : "some_processor",
            "_dead_letter_action": "kafka_dead_letter"
        }
    ]
}
```

Here is a custom processor for the job described above

```javascript
// located at /some_processor/processor.ts

export default class SomeProcessor extends BatchProcessor {
    async onBatch(data) {
        const results = [];

        for (const record of data) {
            if (isNumber(record.field)) {
                const field = record.field * 2;
                results.push({ field });
            } else {
                this.rejectRecord(record, `record.field is not a number`)
            }
        }

        return results;
    }
}
```

Here is top level overview on how this would behave based off the processor and job above.

```js
const data = [
    { field: 3 },
    { field: 'Uh oh, i am not a number' },
    { field: 10 },
    { notField: 'Uh oh, i am not a number' },
];

const results = await processor.run(data);

results === [{ field: 6 }, { field: 20 }];

/*
records:
    { field: 'Uh oh, i am not a number' }
    { notField: 'Uh oh, i am not a number' }

are sent to topic "failed_record_topic" at the end of the slice
*/
```

## Parameters

| Configuration | Description | Type |  Notes |
| --------- | -------- | ------ | ------ |
| \_name| Name of api operation, it must reflect the exact name of the file | String | required |
| topic | Name of the Kafka topic to send records | String | required |
| size | How many messages will be batched and sent to kafka together. | Number | optional, defaults to `10000` |
| compression | Type of compression to use on record sent to topic, may be set to `none`, `gzip`, `snappy`, `lz4` and `inherit` | String | optional, defaults to `gzip` |
| wait | How long to wait for size messages to become available on the producer, in milliseconds. | String/Duration/Number | optional, defaults to `500` |
| connection | Name of the kafka connection to use when sending data | String | optional, defaults to the 'default' connection in the kafka terafoundation connector config |
| metadata_refresh | How often the producer will poll the broker for metadata information. Set to -1 to disable polling. | String/Duration/Number | optional, defaults to `"5 minutes"` |
| _encoding | Used for specifying the data encoding type when using DataEntity.fromBuffer. May be set to `json` or `raw` | String | optional, defaults to `json` |
