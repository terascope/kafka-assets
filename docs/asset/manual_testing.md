# Manual Testing

It is often useful to intentionally cause certain error conditions while manually testing the kafka asset. Figuring out how to do this can be tricky and time consuming, so here is a list of things to try. Not all of these have been tested, so config values may need to be adjusted.

Most scenarios use `kafka-configs.sh`, a CLI tool bundled with Kafka for dynamically updating broker, topic, client, and user configs without restarting. Run it from inside a Kafka broker pod (or any host with access to the bootstrap server). Changes take effect immediately and persist until explicitly reverted with `--delete-config`. The location of the script differs by kafka docker image, or be missing completely, but the `apache/kafka` image used by the `ts-scripts` test runner keeps scripts in `opt/kafka/bin/`.

> **Note (Kubernetes):** If running these scripts inside a Kafka pod causes a JMX port conflict
> (common with default Helm settings), prefix the command with:
>
> ```sh
> KAFKA_JMX_OPTS='-Dcom.sun.management.jmxremote.port=5556 -Dcom.sun.management.jmxremote.rmi.port=5556 -Dcom.sun.management.jmxremote.authenticate=false -Dcom.sun.management.jmxremote.ssl=false' <script-name>
> ```

## Scenarios

### Producer

#### 1. Set a Very Small Max Message Size

Causes `RecordTooLargeException` on the producer side — good for testing error handlers.

```bash
# Reject messages larger than 100 bytes
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'max.message.bytes=100' \
  --entity-type topics --entity-name my-topic
```

---

#### 2. Producer Timeouts (Low request.timeout.ms)

Forces producers to time out before the broker responds, useful for testing retry logic and timeout error handling.

```bash
# Set on the producer client config
request.timeout.ms=100
max.block.ms=500
```

---

#### 3. NotEnoughReplicasException (min.insync.replicas)

Set `min.insync.replicas` higher than the number of currently in-sync replicas, then produce with `acks=all`. Producers will get `NotEnoughReplicasException` immediately.

```bash
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'min.insync.replicas=3' \
  --entity-type topics --entity-name my-topic
```

---

### Consumer

#### 4. Force Consumer Group Rebalances (Low Poll Interval)

Causes the consumer to be evicted from the group if it doesn't call `poll()` within the timeout, triggering continuous rebalances. Useful for testing rebalance handling and partition reassignment logic.

```bash
# Set on the consumer client config (not via kafka-configs.sh)
max.poll.interval.ms=1000
```

---

#### 5. Frequent Heartbeat Failures (Low Session Timeout)

Causes the broker to consider the consumer dead if it misses heartbeats, triggering rebalance storms. Combine with a slow consumer to make this reproducible.

```bash
# Set on the consumer client config
session.timeout.ms=1000
heartbeat.interval.ms=300
```

---

### Throughput / Quota

#### 6. Throttle Producer/Consumer Throughput

Simulates slow networks or back-pressure. Triggers THROTTLING behavior in clients and can expose timeout bugs and back-pressure handling issues.

```bash
# Throttle a specific producer to 1KB/s
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'producer_byte_rate=1024' \
  --entity-type clients --entity-name my-producer

# Throttle a consumer
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'consumer_byte_rate=1024' \
  --entity-type clients --entity-name my-consumer
```

---

#### 7. Quota Violations for Users

Triggers quota-exceeded errors in clients connected as that user.

```bash
# Severely restrict a user's throughput
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'producer_byte_rate=1,consumer_byte_rate=1' \
  --entity-type users --entity-name test-user
```

---

### Broker

#### 8. Simulate a Slow/Unresponsive Broker (SIGSTOP/SIGCONT)

Pauses a broker process without killing it, simulating a hung or GC-paused broker. Clients will time out waiting for responses. Resume with `SIGCONT` to restore it.

```bash
# Find the broker PID and pause it
kill -SIGSTOP <broker-pid>

# Resume it
kill -SIGCONT <broker-pid>
```

---

#### 9. Stress Broker Durability (Infrequent Flushing)

Forces the broker to rely on OS-level flushing rather than explicit syncs, simulating a broker under write pressure where durability guarantees are weaker.

```bash
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'log.flush.interval.messages=100000' \
  --entity-type brokers --entity-name 1
```

---

#### 10. Stress Broker I/O (Excessive Flushing)

Forces a fsync after every message, creating extreme disk I/O pressure. Useful for exposing producer timeout and retry behavior under a slow broker.

```bash
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'log.flush.interval.messages=1' \
  --entity-type brokers --entity-name 1
```

---

### Topic / Log

#### 11. Reduce Retention to Force Log Truncation

Useful for testing consumers that fall behind and hit `OffsetOutOfRangeException`.

```bash
# Set retention to 1 second — messages deleted almost immediately
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'retention.ms=1000' \
  --entity-type topics --entity-name my-topic
```

---

#### 12. Disk Pressure via Byte-Based Retention

Forces the broker to continuously delete segments to stay under the size limit. Consumers that fall behind will hit `OffsetOutOfRangeException`.

```bash
# Set retention to 1MB
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'retention.bytes=1048576' \
  --entity-type topics --entity-name my-topic
```

---

#### 13. Force Aggressive Log Segment Rolling

Creates many small segments rapidly, useful for testing log compaction, index corruption resilience, and disk I/O pressure.

```bash
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'segment.ms=1000,segment.bytes=1024' \
  --entity-type topics --entity-name my-topic
```

---

#### 14. Aggressive Log Compaction

Forces compaction to run nearly continuously. Useful for testing consumers reading compacted topics and exposing races between compaction and consumption.

```bash
kafka-configs.sh --bootstrap-server localhost:9092 \
  --alter --add-config 'cleanup.policy=compact,min.cleanable.dirty.ratio=0.01,min.compaction.lag.ms=0' \
  --entity-type topics --entity-name my-topic
```
