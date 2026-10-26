#!/usr/bin/env bash
# Stop the dev server, wipe the embedded DB, reseed demo data, restart the dev server and warm every route.
set -euo pipefail
cd "$(dirname "$0")/../.."
pkill -f "[n]ext dev" 2>/dev/null || true
pkill -f "[n]ext-server" 2>/dev/null || true
sleep 2
rm -rf .data
npm run db:seed >/tmp/seed.log 2>&1
tail -6 /tmp/seed.log
(nohup npm run dev >/tmp/dev.log 2>&1 &)
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login || true)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "dev server up ($code)"
