#!/usr/bin/env bash
# Smoke test against `wrangler dev` with SerpApi replaced by test/mock-serpapi.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=${BASE:-http://localhost:8787/mcp}
call() {
  curl -sS "$BASE" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
    -H 'mcp-protocol-version: 2025-06-18' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}"
  echo; echo
}
curl -sS "$BASE" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'; echo; echo
curl -sS "$BASE" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -H 'mcp-protocol-version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; echo; echo
call search_places '{"query":"khao soi mae sai"}'
call search_places '{"query":"Single Place","near":"18.79,98.96"}'
call search_places '{"query":"nothing here"}'
call search_places '{"query":"quota test"}'
call get_reviews '{"place":"0x30da3a7e5f5c1a5b:0xabcdef1234567890","max":3}'
call get_reviews '{"place":"0x30da3a7e5f5c1a5b:0xabcdef1234567890","max":40}'
call get_reviews '{"place":"0x30da3a7e5f5c1a5b:0xabcdef1234567890","max":20}'
call get_reviews '{"place":"https://www.google.com/maps/place/Khao+Soi/@18.8,98.97,17z/data=!3m1!4b1!4m6!3m5!1s0x30da3a7e5f5c1a5b:0xabcdef1234567890!8m2!3d18.8!4d98.97","max":2,"sort":"lowest"}'
call get_reviews '{"place":"https://www.google.com/maps/place/Khao+Soi+Mae+Sai/@18.8,98.97,17z","max":2}'
call get_reviews '{"place":"0x1:0x1"}'
call get_reviews '{"place":"pizza"}'
call get_reviews '{"place":"https://www.google.com/maps/place/Khao+Soi+Mae+Sai+2/@18.8,98.97,17z","max":1}'
call get_reviews '{"place":"https://maps.google.com/?cid=12379813812177893520","max":1}'
call get_reviews '{"place":"https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJAAAAAAAAAAAAAAAAAAAAAAA","max":1}'
