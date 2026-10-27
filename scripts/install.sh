#!/usr/bin/env bash
# ==============================================================================
# ZoomPanel - Installer for Ubuntu 26.04 LTS
# Sleek, Modern Web Hosting Control Panel for Node.js, MariaDB & VPS
# ==============================================================================

set -e

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
echo -e "${BOLD}Starting ZoomPanel Installation on Ubuntu 26.04...${NC}\n"

# 1. Root check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this installer as root (e.g. sudo bash install.sh)${NC}"
  exit 1
fi

# 2. Update Apt & Install Base Utilities
echo -e "${BLUE}[1/8] Updating package index and installing dependencies...${NC}"
apt-get update -y
apt-get install -y curl wget git gnupg2 ca-certificates lsb-release ufw openssl nginx

# 3. Install MariaDB 13.0.2
echo -e "${BLUE}[2/8] Installing MariaDB 13.0.2 database server...${NC}"
apt-get install -y mariadb-server mariadb-client
systemctl enable mariadb
systemctl start mariadb

# 4. Setup NodeSource Repository for Node.js LTS
echo -e "${BLUE}[3/8] Installing Node.js LTS runtime...${NC}"
if ! command -v node &> /dev/null; then
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi

# 5. Install PM2 Globally
echo -e "${BLUE}[4/8] Installing PM2 process manager...${NC}"
npm install -g pm2
pm2 startup systemd -u root --hp /root || true

# 6. Create ZoomPanel System Directories
echo -e "${BLUE}[5/8] Configuring ZoomPanel directories...${NC}"
mkdir -p /opt/zoompanel
mkdir -p /etc/zoompanel/ssl
mkdir -p /var/www
mkdir -p /var/log/zoompanel

# Copy application files to /opt/zoompanel
cp -r . /opt/zoompanel/
cd /opt/zoompanel

# Ensure no default or seed sites exist
mkdir -p /opt/zoompanel/backend/data
echo "[]" > /opt/zoompanel/backend/data/sites.json
echo "{}" > /opt/zoompanel/backend/data/site-credentials.json
rm -rf /opt/zoompanel/backend/data/www/* || true
rm -rf /opt/zoompanel/backend/data/home/* || true
rm -rf /opt/zoompanel/backend/data/nginx/sites-available/* || true
rm -rf /opt/zoompanel/backend/data/nginx/sites-enabled/* || true

# Install dependencies and build frontend and backend
echo -e "${BLUE}[6/8] Building ZoomPanel services...${NC}"
cd /opt/zoompanel/backend && npm install && npm run build
cd /opt/zoompanel/frontend && npm install && npm run build

# 7. Configure Systemd Service (Daemon on Port 8443)
echo -e "${BLUE}[7/8] Creating ZoomPanel systemd daemon service on port 8443...${NC}"
cat << 'SERVICE_EOF' > /etc/systemd/system/zoompanel.service
[Unit]
Description=ZoomPanel Hosting Control Panel Daemon
After=network.target nginx.service mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/zoompanel/backend
ExecStart=/usr/bin/node dist/backend/src/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=8443

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable zoompanel.service
systemctl restart zoompanel.service

# 8. Configure Firewall (UFW)
echo -e "${BLUE}[8/8] Configuring Firewall (UFW)...${NC}"
# Allow essential ports matching ZoomPanel default rules:
# Web traffic (80, 443) and ZoomPanel Daemon (8443) enabled by default for both IPv4 and IPv6
ufw allow 80/tcp comment 'ZoomPanel HTTP' || true
ufw allow 443/tcp comment 'ZoomPanel HTTPS' || true
ufw allow 8443/tcp comment 'ZoomPanel Daemon' || true
# Note: SSH/SFTP (port 22) and MariaDB (port 3306) entries are disabled by default in ZoomPanel WAF

# Detect Server IP
SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

echo -e "\n${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}  ZoomPanel Successfully Installed & Running!       ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "\nAccess your ZoomPanel dashboard at:"
echo -e "${CYAN}${BOLD}  http://${SERVER_IP}:8443${NC}"
echo -e "\nManage sites (Node.js apps starting at port 3000), MariaDB 13.0.2 databases, and files."
echo -e "Service status: ${BOLD}systemctl status zoompanel${NC}\n"
