# ZoomPanel Runtime State Directory (`backend/data/`)

This directory holds runtime state, configuration stores, and local mock files used by the ZoomPanel backend daemon.

---

## 🔒 Security & Git Tracking

Except for this `README.md` and `.gitkeep` files, **all contents of this directory are strictly ignored by `.gitignore`**.

- **Do NOT commit credentials or keys**: Files in this directory contain salted password hashes (`users.json`), database passwords (`site-credentials.json`), private host keys (`ssh_host_rsa_key`), and TLS/SSL private keys (`ssl/`).
- **Auto-Initialization**: When running in a fresh clone or new server, ZoomPanel's background services (`authService`, `sitesService`, `firewallService`, `mariaDbService`) will automatically detect missing files and bootstrap default state on application boot.

---

## 📁 File & Directory Manifest

| File / Folder | Purpose | Managed By |
| :--- | :--- | :--- |
| `sites.json` | Stores active sites, port assignments, domains, and runtime configs. | `sites.service.ts` |
| `site-credentials.json` | Stores generated database passwords and site access keys. | `system-user.service.ts` |
| `users.json` | Panel administrator accounts, PBKDF2/salted password hashes, and profiles. | `auth.service.ts` |
| `settings.json` | Global panel settings (initialized status, server timezone). | `auth.service.ts` |
| `firewall.json` | UFW firewall rules, custom port entries, and IP allow/deny lists. | `firewall.service.ts` |
| `databases.json` | Active MariaDB databases, users, and association metadata. | `mariadb.service.ts` |
| `mock_tables.json` | Mock schema and sample table data used for local DB Admin UI development. | `mariadb.service.ts` |
| `sftp-state.json` | SFTP daemon status (enabled/disabled) and configuration. | `sftp.service.ts` |
| `ssh_host_rsa_key` | Auto-generated RSA private key used by the embedded SSH/SFTP server. | `sftp.service.ts` |
| `nginx/` | Mock/staging NGINX configurations (`sites-available`, `sites-enabled`). | `nginx.service.ts` |
| `ssl/` | Generated self-signed certificates and private keys (`.crt`, `.key`). | `ssl.service.ts` |
| `home/` & `www/` | Local document roots and user directories when running outside Linux VPS. | `files.service.ts` |

---

## 💻 Development vs. Production VPS

- **Local Development**: ZoomPanel uses this directory as a fast, file-backed JSON database so you can develop UI and API routes on Windows, macOS, or non-root environments without needing Linux systemd or root privileges.
- **Production VPS (Ubuntu)**: The production installer (`scripts/install.sh`) initializes `/opt/zoompanel/backend/data` and links server configurations directly with real system services (`/etc/nginx`, `/var/www`, `/etc/systemd/system`, and MariaDB).

