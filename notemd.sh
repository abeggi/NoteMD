#!/bin/bash
set -e

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PROJECT_ROOT="$SCRIPT_DIR"
NODE_BIN="$(command -v node)"
SERVICE_NAMES=("notemd-backend" "notemd-frontend")

usage() {
    echo "NoteMD service manager"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build      Compile backend and frontend for production"
    echo "  install    Build + install systemd services (requires root)"
    echo "  uninstall  Stop, disable, remove systemd services (requires root)"
    echo "  start      Start both services (requires root)"
    echo "  stop       Stop both services (requires root)"
    echo "  restart    Restart both services (requires root)"
    echo "  status     Show service status"
    exit 1
}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "ERROR: '$1' requires root. Run with sudo."
        exit 1
    fi
}

build_backend() {
    echo "Building backend..."
    (cd "$PROJECT_ROOT/backend" && npm run build)
    echo "  Backend build complete."
}

build_frontend() {
    echo "Building frontend..."
    (cd "$PROJECT_ROOT/frontend" && VITE_API_URL=http://localhost:3001 pnpm build)
    echo "  Frontend build complete."
}

cmd_build() {
    echo "=== Building NoteMD ==="
    build_backend
    build_frontend
    echo "Build complete."
}

cmd_install() {
    require_root "install"

    if [ ! -f "$PROJECT_ROOT/backend/dist/index.js" ] || [ ! -d "$PROJECT_ROOT/frontend/.output" ]; then
        echo "Compiled output not found. Running build first..."
        cmd_build
    fi

    if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
        echo "WARNING: $PROJECT_ROOT/backend/.env not found. Copying from .env.example..."
        if [ -f "$PROJECT_ROOT/backend/.env.example" ]; then
            cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env"
            echo "  Created $PROJECT_ROOT/backend/.env from example."
            echo "  IMPORTANT: Edit backend/.env with your JWT_SECRET and ENCRYPTION_KEY."
        fi
    fi

    echo "=== Installing NoteMD services ==="

    for src in "$PROJECT_ROOT"/*.service; do
        [ -f "$src" ] || continue
        name="$(basename "$src")"
        dst="/etc/systemd/system/$name"
        echo -n "  $name..."
        sed -e "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" \
            -e "s|__NODE__|$NODE_BIN|g" \
            "$src" > "$dst"
        echo " installed"
    done

    systemctl daemon-reload
    systemctl enable notemd-backend.service
    systemctl enable notemd-frontend.service

    echo "Done. Use '$0 start' or '$0 status'."
}

cmd_uninstall() {
    require_root "uninstall"
    echo "=== Uninstalling NoteMD services ==="

    for name in "${SERVICE_NAMES[@]}"; do
        svc="$name.service"
        if systemctl list-units --full -all 2>/dev/null | grep -q "$svc"; then
            echo -n "  $svc..."
            systemctl stop "$svc" 2>/dev/null || true
            systemctl disable "$svc" 2>/dev/null || true
            echo " stopped and disabled"
        fi
    done

    for f in /etc/systemd/system/notemd-backend.service /etc/systemd/system/notemd-frontend.service; do
        if [ -f "$f" ]; then
            rm -f "$f"
            echo "  Removed $f"
        fi
    done

    systemctl daemon-reload 2>/dev/null || true
    echo "Done."
}

cmd_start() {
    require_root "start"
    for name in "${SERVICE_NAMES[@]}"; do
        systemctl start "$name.service"
    done
    echo "NoteMD started."
}

cmd_stop() {
    require_root "stop"
    for name in "${SERVICE_NAMES[@]}"; do
        systemctl stop "$name.service" 2>/dev/null || true
    done
    echo "NoteMD stopped."
}

cmd_restart() {
    require_root "restart"
    for name in "${SERVICE_NAMES[@]}"; do
        systemctl restart "$name.service"
    done
    echo "NoteMD restarted."
}

cmd_status() {
    for name in "${SERVICE_NAMES[@]}"; do
        if command -v systemctl >/dev/null && systemctl list-units --full -all 2>/dev/null | grep -q "$name.service"; then
            systemctl status "$name.service" --no-pager 2>&1 || true
        else
            echo "$name.service — not installed"
        fi
        echo ""
    done
}

case "${1:-}" in
    build)     cmd_build ;;
    install)   cmd_install ;;
    uninstall) cmd_uninstall ;;
    start)     cmd_start ;;
    stop)      cmd_stop ;;
    restart)   cmd_restart ;;
    status)    cmd_status ;;
    *)         usage ;;
esac
