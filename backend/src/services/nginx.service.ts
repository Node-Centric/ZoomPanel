import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Site } from '../../../shared/types.js';

const execAsync = promisify(exec);

export class NginxService {
  private sitesAvailableDir: string;
  private sitesEnabledDir: string;

  constructor() {
    if (process.platform === 'linux') {
      this.sitesAvailableDir = '/etc/nginx/sites-available';
      this.sitesEnabledDir = '/etc/nginx/sites-enabled';
    } else {
      this.sitesAvailableDir = path.resolve(process.cwd(), 'data', 'nginx', 'sites-available');
      this.sitesEnabledDir = path.resolve(process.cwd(), 'data', 'nginx', 'sites-enabled');
    }
  }

  public async init(): Promise<void> {
    await fs.mkdir(this.sitesAvailableDir, { recursive: true });
    await fs.mkdir(this.sitesEnabledDir, { recursive: true });
  }

  public generateConfigString(site: Site): string {
    const serverNames = [site.domain, ...(site.aliases || [])].join(' ');
    const upstreamName = `zoom_upstream_${site.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    return `# ZoomPanel Virtual Host Configuration
# Domain: ${site.domain}
# Generated: ${new Date().toISOString()}

upstream ${upstreamName} {
    server 127.0.0.1:${site.port};
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${serverNames};

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${serverNames};

    # SSL Certificates
    ssl_certificate "${site.ssl.certPath}";
    ssl_certificate_key "${site.ssl.keyPath}";

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Root and logs
    root "${site.rootDirectory}";
    access_log /var/log/nginx/${site.domain}.access.log;
    error_log /var/log/nginx/${site.domain}.error.log;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Reverse Proxy to Node.js / PM2 Application
    location / {
        proxy_pass http://${upstreamName};
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
`;
  }

  public async deployVhost(site: Site): Promise<void> {
    await this.init();
    const configContent = this.generateConfigString(site);
    const availablePath = path.join(this.sitesAvailableDir, `${site.domain}.conf`);
    const enabledPath = path.join(this.sitesEnabledDir, `${site.domain}.conf`);

    // Write to sites-available
    await fs.writeFile(availablePath, configContent, 'utf-8');

    // Link to sites-enabled if not already linked
    try {
      await fs.unlink(enabledPath).catch(() => {});
      if (process.platform === 'linux') {
        await execAsync(`ln -s "${availablePath}" "${enabledPath}"`);
      } else {
        await fs.writeFile(enabledPath, configContent, 'utf-8');
      }
    } catch {
      // ignore link collision
    }

    // Test and reload Nginx
    await this.testAndReload();
  }

  public async removeVhost(domain: string): Promise<void> {
    const availablePath = path.join(this.sitesAvailableDir, `${domain}.conf`);
    const enabledPath = path.join(this.sitesEnabledDir, `${domain}.conf`);

    await fs.unlink(availablePath).catch(() => {});
    await fs.unlink(enabledPath).catch(() => {});

    await this.testAndReload();
  }

  public async getVhostConfig(site: Site): Promise<string> {
    await this.init();
    const availablePath = path.join(this.sitesAvailableDir, `${site.domain}.conf`);
    try {
      const content = await fs.readFile(availablePath, 'utf-8');
      if (content && content.trim().length > 0) {
        return content;
      }
    } catch {
      // not yet written
    }
    return this.generateConfigString(site);
  }

  public async saveVhostConfig(site: Site, configContent: string): Promise<{ success: boolean; message: string }> {
    await this.init();
    const availablePath = path.join(this.sitesAvailableDir, `${site.domain}.conf`);
    const enabledPath = path.join(this.sitesEnabledDir, `${site.domain}.conf`);

    // Backup previous config if on linux
    let backup: string | null = null;
    try {
      backup = await fs.readFile(availablePath, 'utf-8');
    } catch {}

    // Write to sites-available
    await fs.writeFile(availablePath, configContent, 'utf-8');

    // Link or write to sites-enabled
    try {
      await fs.unlink(enabledPath).catch(() => {});
      if (process.platform === 'linux') {
        await execAsync(`ln -s "${availablePath}" "${enabledPath}"`);
      } else {
        await fs.writeFile(enabledPath, configContent, 'utf-8');
      }
    } catch {
      // ignore
    }

    // Test and reload Nginx
    const res = await this.testAndReload();
    if (!res.success && backup !== null && process.platform === 'linux') {
      // Revert if syntax test failed
      await fs.writeFile(availablePath, backup, 'utf-8');
      await this.testAndReload().catch(() => {});
      throw new Error(`NGINX configuration test failed: ${res.message}. Changes were reverted.`);
    }

    return res;
  }

  public async testAndReload(): Promise<{ success: boolean; message: string }> {
    if (process.platform === 'linux') {
      try {
        await execAsync('nginx -t');
        await execAsync('systemctl reload nginx');
        return { success: true, message: 'Nginx reloaded successfully' };
      } catch (err: any) {
        return { success: false, message: err.stderr || err.message };
      }
    }
    return { success: true, message: 'Simulated Nginx reload (dev mode)' };
  }
}

export const nginxService = new NginxService();
