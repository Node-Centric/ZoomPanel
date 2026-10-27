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
