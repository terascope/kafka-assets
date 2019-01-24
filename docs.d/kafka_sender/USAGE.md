**Example Job Config:**

```js
{
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.0.2"
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
