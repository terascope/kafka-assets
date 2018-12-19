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
