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

**Install Teraslice CLI**

```bash
yarn global add teraslice-cli
```

```bash
teraslice-cli assets build
```

### Documentation

To update the documentation run the following command.

```bash
./scripts/doc-generator.js
```