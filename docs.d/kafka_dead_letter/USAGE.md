**Example Job Config:**

```js
{
    // make sure to include the asset bundle
    // additionally you can specify the version
    // "kafka:2.0.3"
    "assets": [ "kafka" ],
    "apis": [
        {
            "_name": "kafka_dead_letter",
            // Specify the topic to push the dead letter queue to
            "topic" : "a9bs823...",
        }
    ],
    // ...
    "operations": [
        // This example uses the kafka reader, but any processor that supports the dead letter API should be able to support the kafka dead letter queue
        {
            "_op": "kafka_reader",
            // Make sure to specify the dead letter action
            "_dead_letter_action": "kafka_dead_letter",
            // the kafka topic to subscribe to
            "topic": "d9c7ba7..."
            // the kafka consumer group
            "group": "4e69b5271-4a6..."
        },
    ]
    // ...
}
```
