#!/usr/bin/env bash
# Seed Beacon with a few beginner-friendly repos so the feed has content.
set -euo pipefail

API="${BEACON_API:-http://localhost:3001}"

REPOS=(
  "https://github.com/expressjs/cors"
  "https://github.com/sindresorhus/ky"
  "https://github.com/fastify/fastify"
)

for url in "${REPOS[@]}"; do
  echo "→ analyzing $url"
  curl -sf -X POST "$API/analyze" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$url\"}" | sed 's/^/  /'
  echo
done

echo "Seeded ${#REPOS[@]} repos — watch progress at http://localhost:5173"
