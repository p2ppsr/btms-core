#!/bin/sh

set -e

host1="$1"
port1="$2"
host2="$3"
port2="$4"
shift 4

echo "Waiting for $host1:$port1..."
while ! nc -z $host1 $port1; do
  sleep 1
done
echo "$host1:$port1 is up"

echo "Waiting for $host2:$port2..."
while ! nc -z $host2 $port2; do
  sleep 1
done
echo "$host2:$port2 is up"

exec "$@"