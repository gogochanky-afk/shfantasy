#!/bin/bash
echo "=== Testing All Routes ==="
echo ""

# Test API routes
echo "1. GET /api/health"
curl -s http://localhost:8080/api/health | jq -c '{ok, service, data_mode}'
echo ""

echo "2. GET /api/pools"
curl -s http://localhost:8080/api/pools | jq -c '{ok, data_mode, pool_count: (.pools | length)}'
echo ""

echo "3. GET /api/entries"
curl -s http://localhost:8080/api/entries | jq -c '{ok, data_mode, entry_count: (.entries | length)}'
echo ""

# Test frontend routes (check status code only)
echo "4. GET / (home)"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/
echo ""

echo "5. GET /arena"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/arena
echo ""

echo "6. GET /my-entries"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/my-entries
echo ""

echo "7. GET /how-it-works"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080/how-it-works
echo ""

echo "=== All Tests Complete ==="
