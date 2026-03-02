#!/bin/bash
# Simple route test script for snapshot backend

echo "Testing /api/pools"
curl -s http://localhost:8080/api/pools | jq .

echo "Testing /api/players"
curl -s http://localhost:8080/api/players | jq .

echo "Testing /api/join"
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"userId":"u123","poolId":1}' \
  http://localhost:8080/api/join | jq .
