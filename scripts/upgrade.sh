#!/usr/bin/env bash
# ==============================================================================
# ZoomPanel - In-Place Upgrade Script for Ubuntu Servers & VPS
# Safely upgrades ZoomPanel core daemon & web UI while preserving all customer
# data, sites, databases, certificates, and firewall rules.
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ______                     _____                  _ 
 |___  /                    |  __ \                | |
    / / ___   ___  _ __ ___ | |__) |_ _ _ __   ___ | |
   / / / _ \ / _ \| '_ ` _ \|  ___/ _` | '_ \ / _ \| |
  / /_| (_) | (_) | | | | | | |  | (_| | | | |  __/| |
 /_____\___/ \___/|_| |_| |_|_|   \__,_|_| |_|\___||_|
EOF
echo -e "${NC}"
echo -e "${BOLD}Starting ZoomPanel In-Place Upgrade...${NC}\n"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this upgrade script as root (e.g. sudo bash scripts/upgrade.sh)${NC}"
  exit 1
fi

PANEL_DIR="/opt/zoompanel"
if [ ! -d "$PANEL_DIR" ]; then
  # Fallback to current directory if not at /opt/zoompanel
  PANEL_DIR="$(pwd)"
fi

cd "$PANEL_DIR"
echo -e "${BLUE}[1/5] Working directory: ${PANEL_DIR}${NC}"

# 2. Automated Safety Backup of Runtime State
BACKUP_DIR="/opt/zoompanel/backups/data_$(date +%Y%m%d_%H%M%S)"
echo -e "${BLUE}[2/5] Creating safety snapshot of state and credentials...${NC}"
mkdir -p "$BACKUP_DIR"

if [ -d "$PANEL_DIR/backend/data" ]; then
  cp -r "$PANEL_DIR/backend/data" "$BACKUP_DIR/"
  echo -e "${GREEN}✓ State backed up to: ${BACKUP_DIR}${NC}"
fi

# 3. Pull latest code if Git repo
if [ -d "$PANEL_DIR/.git" ]; then
  echo -e "${BLUE}[3/5] Pulling latest updates from git repository...${NC}"
  # Stash any local runtime modifications if necessary
  git pull --rebase || git pull || {
    echo -e "${YELLOW}[WARNING] git pull encountered a conflict or failure. Continuing with local files...${NC}"
  }
else
  echo -e "${BLUE}[3/5] Non-git deployment detected. Using current local files.${NC}"
fi

# 4. Install updated dependencies and rebuild
echo -e "${BLUE}[4/5] Installing updated dependencies and building application...${NC}"

# Clean old build artifacts to ensure fresh build
rm -rf "$PANEL_DIR/backend/dist" "$PANEL_DIR/frontend/dist"

npm install --include=optional

# Ensure native Linux Rollup binary is present
ARCH=$(uname -m)
ROLLUP_PKG=""
if [ "$ARCH" = "x86_64" ]; then
  ROLLUP_PKG="@rollup/rollup-linux-x64-gnu"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  ROLLUP_PKG="@rollup/rollup-linux-arm64-gnu"
fi

if [ -n "$ROLLUP_PKG" ]; then
  if [ ! -d "$PANEL_DIR/node_modules/$ROLLUP_PKG" ] && [ ! -d "$PANEL_DIR/frontend/node_modules/$ROLLUP_PKG" ]; then
    echo -e "${BLUE}Ensuring native bundler binary ($ROLLUP_PKG) is installed...${NC}"
    npm install "$ROLLUP_PKG" --save-optional --workspace=frontend || true
  fi
fi

# Recompile backend daemon and frontend SPA
npm run build

# 5. Restart ZoomPanel Daemon & Verify Health
echo -e "${BLUE}[5/5] Restarting ZoomPanel systemd service...${NC}"
systemctl daemon-reload
systemctl restart zoompanel.service

# Wait up to 10 seconds for daemon to come online
echo -e "${BLUE}Verifying daemon health...${NC}"
HEALTHY=false
for i in {1..10}; do
  if curl -sf http://127.0.0.1:8443/health > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 1
done

if [ "$HEALTHY" = true ]; then
  HEALTH_JSON=$(curl -s http://127.0.0.1:8443/health)
  echo -e "\n${GREEN}${BOLD}======================================================${NC}"
  echo -e "${GREEN}${BOLD}  ZoomPanel Successfully Upgraded & Running!         ${NC}"
  echo -e "${GREEN}${BOLD}======================================================${NC}"
  echo -e "${GREEN}Daemon response: ${HEALTH_JSON}${NC}\n"
else
  echo -e "\n${YELLOW}[WARNING] Daemon did not report healthy within 10 seconds.${NC}"
  echo -e "Check service logs using: ${BOLD}journalctl -u zoompanel.service -n 50 --no-pager${NC}\n"
fi

