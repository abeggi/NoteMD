#!/bin/sh
set -e

PIDS_FILE="/tmp/notemd.pids"
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

usage() {
    echo "Usage: $0 {start|stop}"
    exit 1
}

install_deps() {
    if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
        echo "Installing backend dependencies..."
        (cd "$SCRIPT_DIR/backend" && npm install)
    fi
    if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
        echo "Installing frontend dependencies..."
        (cd "$SCRIPT_DIR/frontend" && pnpm install)
    fi
}

start() {
    if [ -f "$PIDS_FILE" ] && kill -0 $(head -1 "$PIDS_FILE") 2>/dev/null; then
        echo "NoteMD is already running."
        exit 1
    fi

    install_deps

    echo "Starting NoteMD..."
    setsid sh -c "(cd \"$SCRIPT_DIR/backend\" && npm run dev)" 2>/dev/null &
    BACKEND_PID=$!
    echo "Backend (PID $BACKEND_PID)"

    setsid sh -c "(cd \"$SCRIPT_DIR/frontend\" && HOST=0.0.0.0 pnpm run dev)" 2>/dev/null &
    FRONTEND_PID=$!
    echo "Frontend (PID $FRONTEND_PID)"

    echo "$BACKEND_PID" > "$PIDS_FILE"
    echo "$FRONTEND_PID" >> "$PIDS_FILE"

    echo "http://localhost:3000"
    echo "Use '$0 stop' to stop."
}

stop() {
    if [ ! -f "$PIDS_FILE" ]; then
        echo "NoteMD is not running."
        return
    fi

    echo "Stopping NoteMD..."
    while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM -"$pid" 2>/dev/null && echo "Stopped PGID $pid"
        fi
    done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
    echo "NoteMD stopped."
}

case "${1:-}" in
    start) start ;;
    stop) stop ;;
    *) usage ;;
esac
