#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR" || exit

mkdir -p ./data
mkdir -p ./logs

POSTGRES_DB=default
POSTGRES_USER=default
POSTGRES_PASSWORD=secret
CONTAINER_NAME=arepository_postgres_local
MAX_ATTEMPTS=10
SLEEP_SECONDS=5

# Check if the container is already running with the same name
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
  echo "A container $CONTAINER_NAME is already running."
else

## envs and explanations @url https://github.com/docker-library/docs/blob/master/postgres/README.md#environment-variables
docker run -d \
  --restart always \
  --publish=5432:5432 \
  --volume="$SCRIPT_DIR"/data:/var/lib/postgresql/data \
  --env POSTGRES_DB=$POSTGRES_DB \
  --env POSTGRES_USER=$POSTGRES_USER \
  --env POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  --name $CONTAINER_NAME \
  postgres:12
fi

# Wait for PostgreSQL to become ready
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    echo "Attempting to connect to PostgreSQL (attempt: $attempt)..."
    # Attempt to connect (modify -h localhost to your container's IP if different)
    docker exec $CONTAINER_NAME psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -c "\q" 2>/dev/null && break
    attempt=$(( attempt + 1 ))
    sleep $SLEEP_SECONDS
done

if [ $attempt -le $MAX_ATTEMPTS ]; then
    echo "PostgreSQL is up and ready for connections."
else
    echo "Failed to connect to PostgreSQL after $MAX_ATTEMPTS attempts."
fi
