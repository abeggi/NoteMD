#!/bin/sh
set -e

echo "Starting NoteMD..."

cd /app/backend
node dist/index.js &
BACKEND_PID=$!

sleep 3

cd /app/frontend
PORT=3000 node .output/server/index.mjs &
FRONTEND_PID=$!

echo "NoteMD started — http://localhost:3000"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT TERM

wait -n
exit $?
