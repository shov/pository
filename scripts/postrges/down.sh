#!/usr/bin/env sh
docker stop arepository_postgres_local && \
docker rm arepository_postgres_local && \
echo "Postgres container stopped and removed." || echo "Cannot stop and remove Postgres container. Check if it exists."
