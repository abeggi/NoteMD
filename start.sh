#!/bin/sh
set -e

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PIDS_FILE="/tmp/notemd.pids"
LOG_DIR="/tmp/notemd-logs"

usage() {
    echo "Usage: $0 {start|stop|restart|status}"
    echo ""
    echo "  start    Start backend (port 3001) and frontend (port 3000)"
    echo "  stop     Stop both services"
    echo "  restart  Stop then start"
    echo "  status   Show if services are running"
    exit 1
}

# Check if a port is in use
port_in_use() {
    ss -tlnp 2>/dev/null | grep -q ":$1\b" || lsof -i:"$1" >/dev/null 2>&1
}

# Kill any process listening on a port
free_port() {
    local pid
    pid=$(lsof -ti:"$1" 2>/dev/null)
    if [ -n "$pid" ]; then
        kill $pid 2>/dev/null
        sleep 1
        # Force kill if still alive
        kill -9 $pid 2>/dev/null || true
    fi
}

install_deps() {
    if [ ! -d "$BACKEND_DIR/node_modules" ]; then
        echo "Installing backend dependencies..."
        (cd "$BACKEND_DIR" && npm install)
    fi
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo "Installing frontend dependencies..."
        (cd "$FRONTEND_DIR" && pnpm install)
    fi
}

status() {
    local running=0
    if port_in_use 3001; then
        echo "Backend  : RUNNING (port 3001)"
        running=1
    else
        echo "Backend  : stopped"
    fi
    if port_in_use 3000; then
        echo "Frontend : RUNNING (port 3000)"
        running=1
    else
        echo "Frontend : stopped"
    fi
    return $running
}

start() {
    # Check if already running by port
    if port_in_use 3001 || port_in_use 3000; then
        echo "NoteMD is already running. Use '$0 stop' first, or '$0 status'."
        exit 1
    fi

    install_deps

    echo "Starting NoteMD..."
    mkdir -p "$LOG_DIR"

    # Start backend
    (cd "$BACKEND_DIR" && npm run dev) > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "Backend  (PID $BACKEND_PID) — port 3001"

    # Start frontend
    (cd "$FRONTEND_DIR" && HOST=0.0.0.0 pnpm run dev) > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend (PID $FRONTEND_PID) — port 3000"

    # Save PIDs
    echo "$BACKEND_PID" > "$PIDS_FILE"
    echo "$FRONTEND_PID" >> "$PIDS_FILE"

    # Wait for backend to be ready
    echo -n "Waiting for backend..."
    for i in $(seq 1 15); do
        if port_in_use 3001; then
            echo " ready"
            break
        fi
        sleep 1
        echo -n "."
    done
    if ! port_in_use 3001; then
        echo " failed"
        echo "Check $LOG_DIR/backend.log for errors"
        exit 1
    fi

    echo ""
    echo "NoteMD running at http://localhost:3000"
    echo "Logs: $LOG_DIR/backend.log  $LOG_DIR/frontend.log"
    echo "Use '$0 stop' to stop."
}

stop() {
    local stopped=0
    echo "Stopping NoteMD..."

    # Kill by port first (handles processes started outside this script)
    for port in 3000 3001; do
        if port_in_use $port; then
            echo -n "  Port $port..."
            free_port $port
            echo " stopped"
            stopped=1
        fi
    done

    # Also kill by PID file (cleanup legacy)
    if [ -f "$PIDS_FILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                echo -n "  PID $pid..."
                kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
                echo " stopped"
                stopped=1
            fi
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi

    if [ $stopped -eq 0 ]; then
        echo "NoteMD is not running."
    else
        sleep 1
        echo "NoteMD stopped."
    fi
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    *)       usage ;;
esac
