#!/bin/bash

set -e

list_topics() {
    kafka-topics --list --zookeeper 'localhost:2181' | grep 'kafka-test-' | xargs -n 1
}

delete_topic() {
    local topic="$1"
    kafka-topics --zookeeper localhost:2181 --delete --topic "$topic"
}

main() {
    for topic in $(list_topics); do
        echo "* deleting $topic..."
        delete_topic "$topic" > /dev/null
    done
}

main "$@"
