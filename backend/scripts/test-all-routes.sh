#!/bin/bash
echo "Testing pools"
curl -s http://localhost:8080/api/pools | jq .
echo ""

echo "Testing players"
curl -s http://localhost:8080/api/players | jq .
echo ""

echo "Testing user entries"
curl -s "http://localhost:8080/api/entry/my-entries?userId=u123" | jq .
echo ""

echo "Done."
