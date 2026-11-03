# ZoomPanel ⚡
> Modern, High-Performance Web Hosting Control Panel for Ubuntu Servers & VPS.

ZoomPanel is a next-generation web hosting control panel designed specifically for speed, simplicity, and an elevated user experience. Built with a sleek, light aesthetic, soft curved surfaces, and intuitive navigation, ZoomPanel simplifies managing Node.js applications, MariaDB 13.0.2 databases, NGINX virtual hosts, SSL certificates, and server files.

---

## ✨ Features

- **🎨 Modern Light UI/UX**:
  - Soft-curved container cards (`rounded-2xl` / `rounded-3xl`) with gentle ambient elevation.
  - Zero clutter: clean white surfaces on a soft porcelain slate background (`#F8FAFC`).
  - Real-time hardware telemetry: CPU load, Memory (RAM), Disk usage, and Server Uptime.

- **⬡ Extensible Site Type System (Starting with Node.js)**:
  - Clean card-based runtime selector for creating new sites.
  - Prominent **Node.js Application** card highlighting PM2 clustering, reverse proxying, and auto-restart capabilities.
  - Extensible architecture ready to register PHP, Python, or Static sites as ZoomPanel grows.

- **🔌 Port Architecture & Strict Conflict Enforcement**:
  - ZoomPanel daemon listens on port **8443**.
  - Node.js sites start at port **3000** and auto-increment to one higher than the highest assigned port.
  - **Zero Duplicate Ports Allowed**: Real-time validation in the wizard prevents conflicts with visual feedback and blocks proceeding until resolved.

- **🗄️ MariaDB 13.0.2 Database Management**:
  - Optional per-site database support toggled during site creation or later in Site Settings.
  - Dedicated **Databases Tab** on the site details page:
    - Create databases and dedicated users with auto-generated passwords.
    - Copy database connection URLs (`mysql://user:pass@localhost:3306/dbname`).
    - Delete databases with confirmation.
  - **Safety Constraint**: Database support cannot be turned off for a site while active databases exist, preventing accidental orphaned database data.
  - **Custom Database Admin UI**: Dedicated full-screen management interface designed with ZoomPanel's light modern aesthetic (replaces 3rd-party tools like phpMyAdmin/DBGate):
    - Left sidebar database treeview of all tables with column inspection (types, keys, nullability).
    - Data Browser with sorting, pagination, and "+ Insert Row" modal.
    - Schema / Structure inspector.
    - Interactive SQL Query Console with execution metrics.

- **🌐 NGINX Reverse Proxy Engine**:
  - Automatically generates clean virtual host configurations (`/etc/nginx/sites-available/<domain>.conf`).
  - Automatic HTTP to HTTPS redirection.
  - Built-in WebSocket upgrade support (`$http_upgrade`).
  - Security headers and performance-tuned proxy timeouts.

- **🔒 SSL Certificate Lifecycle**:
  - **Self-Signed Certificates**: Instant 2048-bit OpenSSL certificates generated upon site creation for immediate HTTPS functionality without waiting for DNS propagation.
  - Architecture ready for automated Let's Encrypt / ACME issuance.

- **🚀 PM2 Process Supervisor**:
  - Native Node.js process management with auto-restart on crash and server reboots (`pm2 startup` & `pm2 save`).
  - Live process status (Running, Stopped, Restarting), PID tracking, and memory monitoring.
  - Integrated real-time log terminal viewer.

- **📁 Built-in File Manager & Code Editor**:
  - Server-wide file manager and site-scoped file manager directly on `/var/www/<domain>`.
  - In-browser code editor with syntax styling, line numbers, and `Ctrl+S` auto-save.

---

## 🚀 Installation on Ubuntu 26.04 LTS

To install ZoomPanel on a fresh Ubuntu 26.04 server or VPS:

```bash
# Clone the repository or download the installer
git clone https://github.com/your-username/zoompanel.git /opt/zoompanel
cd /opt/zoompanel

# Run the installer as root
sudo bash scripts/install.sh
```

The installer will automatically:
1. Update system packages and install `nginx`, `openssl`, `ufw`, and `curl`.
2. Install **MariaDB 13.0.2** database server.
3. Install the **Node.js LTS** runtime and **PM2** globally.
4. Build the backend daemon and frontend UI.
5. Create and start the `zoompanel.service` systemd daemon on port **8443**.
6. Configure the UFW firewall for ports `22`, `80`, `443`, and `8443`.

Access the panel at:
```
http://<YOUR_SERVER_IP>:8443
```

---

## 🔄 Upgrading an Existing Server

To safely upgrade ZoomPanel without losing any customer sites, databases, credentials, or SSL certificates:

```bash
cd /opt/zoompanel
sudo bash scripts/upgrade.sh
```

The upgrade script automatically:
1. Creates a timestamped safety backup of all state and credentials into `/opt/zoompanel/backups/`.
2. Pulls the latest code updates (if installed via Git) or uses new deployed files.
3. Installs updated dependencies and rebuilds the backend daemon and frontend SPA.
4. Restarts `zoompanel.service` with zero/minimal downtime.
5. Verifies daemon health and reports status.

---

## 💻 Local Development & Contributing

You can develop, test, and contribute to ZoomPanel locally on Windows, macOS, or Linux without needing a dedicated VPS or root access.

### 📁 Repository Structure

```text
ZoomPanel/
├── backend/           # Node.js + Express host management daemon & REST API
│   ├── src/           # Controllers, routes, and Linux service integrations
│   └── data/          # Local JSON database & runtime state (auto-initialized)
├── frontend/          # React 18 + Vite + Tailwind CSS control dashboard
│   └── src/           # Components, pages, layout, and API client
├── shared/            # Shared TypeScript type definitions and domain models
├── scripts/           # Production deployment & Ubuntu installer scripts
├── package.json       # Monorepo/npm workspaces configuration
└── README.md
```

### 📋 Prerequisites
- **Node.js**: v20.x or higher LTS (tested on Node v20–v24)
- **npm**: v10.x or higher

### ⚡ Quickstart

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/zoompanel.git
   cd zoompanel
   ```

2. **Install all dependencies** (installs root, backend, frontend, and shared in one command):
   ```bash
   npm install
   ```

3. **Start both backend and frontend concurrently in development mode**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   - **Frontend UI Dashboard**: [`http://localhost:5173`](http://localhost:5173)
   - **Backend API Daemon**: [`http://localhost:8443/api`](http://localhost:8443/api)
   - **Daemon Health Check**: [`http://localhost:8443/health`](http://localhost:8443/health)

*(The Vite development server automatically proxies `/api` requests to the backend daemon on port `8443`).*

---

### 🛠️ Available NPM Scripts

All commands can be executed from the **project root**:

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `concurrently ...` | Starts both backend daemon and frontend Vite server concurrently. |
| `npm run dev:backend` | `npm run dev -w backend` | Starts only the backend daemon with `tsx watch` hot-reload. |
| `npm run dev:frontend` | `npm run dev -w frontend` | Starts only the frontend Vite development server. |
| `npm run build` | `npm run build -w ...` | Typechecks and compiles both backend (`tsc`) and frontend (`vite build`). |
| `npm run build:backend` | `npm run build -w backend` | Compiles backend TypeScript to `./backend/dist`. |
| `npm run build:frontend` | `npm run build -w frontend` | Bundles frontend React SPA to `./frontend/dist`. |
| `npm run start` | `npm run start -w backend` | Starts the compiled production backend daemon. |

---

### ⚙️ How Local Dev Differs from Production VPS

- **Local Development (Windows / macOS / non-root)**:
  - System commands that require root Linux privileges (e.g., `systemctl`, `ufw`, `openssl`, real NGINX reloads) gracefully fall back to local mock operations.
  - Data is saved directly to JSON files in [`backend/data/`](./backend/data/README.md) (`sites.json`, `firewall.json`, `databases.json`), allowing instant UI and API prototyping.
- **Production VPS (Ubuntu 26.04)**:
  - Run with root privileges via the `zoompanel.service` systemd unit.
  - Interacts directly with `/etc/nginx`, MariaDB 13.0.2, PM2 process manager, and UFW firewall.
