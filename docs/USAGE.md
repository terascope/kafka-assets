## Development

### Tests

Run the kafka tests

**Requirements:**

- `kafka` - A running instance of kafka

**Environment:**
- `KAFKA_BROKERS` - Defaults to `localhost:9091`

```bash
yarn test
```

### Build

Build a compiled asset bundle to deploy to a teraslice cluster.

```bash
./scripts/build.sh
```
