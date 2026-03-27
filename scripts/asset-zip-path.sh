#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_VERSION=$(node -p "require('${SCRIPT_DIR}/../package.json').version")
NODE_VERSION=$(node -p "process.versions.node.split('.')[0]")

echo "./build/kafka-v${PACKAGE_VERSION}-node-${NODE_VERSION}-bundle.zip"