import fs from 'fs/promises';
import path from 'path';
import type { Site, CreateSitePayload, SiteStatus, SiteSSL } from '../../../shared/types.js';
import { sslService } from './ssl.service.js';
import { nginxService } from './nginx.service.js';
import { pm2Service } from './pm2.service.js';
import { mariaDbService } from './mariadb.service.js';
import { systemUserService } from './system-user.service.js';

export const DAEMON_PORT = 8443;
export const FIRST_APP_PORT = 3000;

export class SitesService {
  private dbPath: string;
  private sites: Map<string, Site> = new Map();
  private daemonPort: number = DAEMON_PORT;

  constructor() {
    this.dbPath = path.resolve(process.cwd(), 'data', 'sites.json');
  }

  public getDaemonPort(): number {
    return this.daemonPort;
  }

  public setDaemonPort(port: number): void {
    if (port && !isNaN(port)) {
      this.daemonPort = port;
    }
  }

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const list: Site[] = JSON.parse(data);
      this.sites.clear();
      list.forEach((s) => {
        if (!s.nodeVersion || s.nodeVersion.startsWith('v20')) {
          s.nodeVersion = 'v26.12.1';
        }
        if (!s.siteUser) {
          s.siteUser = s.id.replace(/[^a-z0-9_]/g, '_').slice(0, 32);
        }
        if (!s.sshKeys) {
          s.sshKeys = [];
        }
        this.sites.set(s.id, s);
      });
    } catch {
      this.sites.clear();
      await this.saveDb();
    }
  }

  private async saveDb(): Promise<void> {
    const list = Array.from(this.sites.values());
    await fs.writeFile(this.dbPath, JSON.stringify(list, null, 2), 'utf-8');
  }

  public getUsedPorts(): { port: number; siteId?: string; domain?: string }[] {
    const used: { port: number; siteId?: string; domain?: string }[] = [
      { port: this.daemonPort, domain: 'ZoomPanel Daemon' }
    ];
    for (const site of this.sites.values()) {
      used.push({ port: site.port, siteId: site.id, domain: site.domain });
    }
    return used;
  }

  public getNextAvailablePort(): number {
    const existingPorts = Array.from(this.sites.values()).map((s) => s.port);
    if (existingPorts.length === 0) {
      return FIRST_APP_PORT;
    }
    const maxPort = Math.max(...existingPorts);
    let nextPort = Math.max(FIRST_APP_PORT, maxPort + 1);
    while (nextPort === this.daemonPort || existingPorts.includes(nextPort)) {
      nextPort++;
    }
    return nextPort;
  }

  public getAllSites(): Site[] {
    return Array.from(this.sites.values()).map((s) => {
      const dbs = s.databasesEnabled ? mariaDbService.getDatabasesForSite(s.id) : [];
      const user = s.siteUser || s.id.replace(/[^a-z0-9_]/g, '_').slice(0, 32);
      return { 
        ...s, 
        siteUser: user,
        homeDirectory: s.homeDirectory || systemUserService.getUserHomeDir(user),
        sshKeys: s.sshKeys || [],
        databases: dbs 
      };
    });
  }

  public getSiteById(id: string): Site | undefined {
    const s = this.sites.get(id);
    if (!s) return undefined;
    const dbs = s.databasesEnabled ? mariaDbService.getDatabasesForSite(s.id) : [];
    const user = s.siteUser || s.id.replace(/[^a-z0-9_]/g, '_').slice(0, 32);
    return { 
      ...s, 
      siteUser: user,
      homeDirectory: s.homeDirectory || systemUserService.getUserHomeDir(user),
      sshKeys: s.sshKeys || [],
      databases: dbs 
    };
  }

  public async createSite(payload: CreateSitePayload): Promise<Site> {
    const domainClean = payload.domain.trim().toLowerCase();
    const siteId = domainClean.replace(/[^a-z0-9]/g, '-');

    if (this.sites.has(siteId)) {
      throw new Error(`A site with domain "${domainClean}" already exists.`);
    }

    // Port validation & strict conflict enforcement
    let assignedPort = payload.port;
    if (!assignedPort) {
      assignedPort = this.getNextAvailablePort();
    } else {
      assignedPort = Number(assignedPort);
      if (assignedPort === DAEMON_PORT) {
        throw new Error(`Port ${DAEMON_PORT} is reserved for the ZoomPanel daemon. Please choose another port.`);
      }
      if (assignedPort < 1024 || assignedPort > 65535) {
        throw new Error(`Port ${assignedPort} is invalid. Application ports must be between 1024 and 65535.`);
      }
      // Check collision
      const conflictingSite = Array.from(this.sites.values()).find((s) => s.port === assignedPort);
      if (conflictingSite) {
        throw new Error(
          `Port ${assignedPort} is already in use by site "${conflictingSite.domain}". Every Node.js site must have a unique application port.`
        );
      }
    }

    // Site User validation
    const siteUserClean = (payload.siteUser || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!siteUserClean || siteUserClean.length < 3) {
      throw new Error('Site User is required and must be at least 3 characters (letters, numbers, underscores).');
    }

    // Create system user and directory structure: /home/{site_user}/www/{domain}/
    await systemUserService.createSystemUser(siteUserClean, payload.sitePassword);
    const rootDirectory = systemUserService.getSiteWwwDir(siteUserClean, domainClean);

    await fs.mkdir(rootDirectory, { recursive: true });

    // Generate sample Node.js application if entry file does not exist
    const entryFileName = payload.entryFile || 'server.js';
    const entryFilePath = path.join(rootDirectory, entryFileName);
    
    try {
      await fs.access(entryFilePath);
    } catch {
      const boilerplate = `// ZoomPanel Node.js Application: ${domainClean}
import http from 'http';

const PORT = process.env.PORT || ${assignedPort};

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Welcome to your Node.js application powered by ZoomPanel!',
    domain: '${domainClean}',
    port: PORT,
    timestamp: new Date().toISOString(),
    status: 'online'
  }, null, 2));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(\`[ZoomPanel] Server running for ${domainClean} on http://127.0.0.1:\${PORT}\`);
});
`;
      await fs.writeFile(entryFilePath, boilerplate, 'utf-8');

      const pkgJson = {
        name: domainClean.replace(/\./g, '-'),
        version: "1.0.0",
        type: "module",
        main: entryFileName,
        scripts: {
          start: `node ${entryFileName}`
        }
      };
      await fs.writeFile(path.join(rootDirectory, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');
    }

    // Generate Self-Signed SSL Certificate
    const ssl = await sslService.generateSelfSignedCert(domainClean, payload.aliases || []);

    const now = new Date().toISOString();
    const site: Site = {
      id: siteId,
      domain: domainClean,
      aliases: payload.aliases || [],
      type: 'nodejs',
      status: 'running',
      port: assignedPort,
      rootDirectory,
      homeDirectory: systemUserService.getUserHomeDir(siteUserClean),
      entryFile: entryFileName,
      nodeVersion: payload.nodeVersion || 'v26.12.1',
      siteUser: siteUserClean,
      sshKeys: [],
      createdAt: now,
      updatedAt: now,
      ssl,
      databasesEnabled: payload.enableDatabases ?? false,
      databases: [],
      env: {
        PORT: String(assignedPort),
        NODE_ENV: 'production',
        ...(payload.env || {})
      },
      pm2: {
        name: `zoom-${siteId}`,
        uptime: 1,
        restarts: 0,
        memory: 32 * 1024 * 1024,
        cpu: 0.5
      }
    };

    // Deploy Nginx Virtual Host
    await nginxService.deployVhost(site);

    // Start with PM2
    await pm2Service.startApp(site);

    // Save in DB
    this.sites.set(siteId, site);
    await this.saveDb();

    return site;
  }

  public async setDatabasesEnabled(siteId: string, enabled: boolean): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');

    if (!enabled) {
      // Check constraint: Cannot disable if databases exist
      const check = mariaDbService.canDisableDatabases(siteId);
      if (!check.canDisable) {
        throw new Error(
          `Cannot disable database support for this site. There are ${check.count} active database(s). Please delete all databases first before disabling.`
        );
      }
    }

    site.databasesEnabled = enabled;
    site.updatedAt = new Date().toISOString();
    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async updateSiteStatus(siteId: string, status: SiteStatus): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');

    if (status === 'stopped') {
      await pm2Service.stopApp(siteId);
    } else if (status === 'running') {
      await pm2Service.startApp(site);
    } else if (status === 'restarting') {
      await pm2Service.restartApp(siteId);
    }

    site.status = status === 'restarting' ? 'running' : status;
    site.updatedAt = new Date().toISOString();
    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async updateSitePort(siteId: string, newPort: number): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');

    const num = Number(newPort);
    if (isNaN(num)) {
      throw new Error('Port must be a valid numeric value.');
    }
    if (num === DAEMON_PORT) {
      throw new Error(`Port ${DAEMON_PORT} is reserved for the ZoomPanel daemon. Please choose another port.`);
    }
    if (num < 1024 || num > 65535) {
      throw new Error(`Port ${num} is invalid. Application ports must be between 1024 and 65535.`);
    }

    // Check collision with other sites
    const conflictingSite = Array.from(this.sites.values()).find((s) => s.id !== siteId && s.port === num);
    if (conflictingSite) {
      throw new Error(
        `Port ${num} is already in use by site "${conflictingSite.domain}". Every Node.js site must have a unique application port.`
      );
    }

    if (site.port === num) {
      return site;
    }

    site.port = num;
    site.env = {
      ...site.env,
      PORT: String(num)
    };
    site.updatedAt = new Date().toISOString();

    // Redeploy NGINX Virtual Host with new upstream port
    await nginxService.deployVhost(site);

    // If site was running, restart with new environment port
    if (site.status === 'running') {
      try {
        await pm2Service.stopApp(siteId);
      } catch {}
      await pm2Service.startApp(site);
    }

    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async updateSiteSsl(siteId: string, ssl: SiteSSL): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');
    site.ssl = ssl;
    site.updatedAt = new Date().toISOString();
    try {
      await nginxService.deployVhost(site);
    } catch {}
    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async deleteSiteSsl(siteId: string): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');
    site.ssl = {
      type: 'none',
      domain: site.domain,
      domains: [site.domain],
      certPath: '',
      keyPath: '',
      autoRenew: false,
      status: 'expired'
    };
    site.updatedAt = new Date().toISOString();
    try {
      await nginxService.deployVhost(site);
    } catch {}
    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async addSshKey(siteId: string, publicKey: string): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');
    const user = site.siteUser || site.id.replace(/[^a-z0-9_]/g, '_').slice(0, 32);
    const keys = await systemUserService.addSshKey(user, publicKey);
    site.sshKeys = keys;
    site.updatedAt = new Date().toISOString();
    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async removeSshKey(siteId: string, publicKey: string): Promise<Site> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');
    const user = site.siteUser || site.id.replace(/[^a-z0-9_]/g, '_').slice(0, 32);
    const keys = await systemUserService.removeSshKey(user, publicKey);
    site.sshKeys = keys;
    site.updatedAt = new Date().toISOString();
    await this.saveDb();
    return this.getSiteById(siteId)!;
  }

  public async resetSiteUserPassword(siteId: string, password: string): Promise<void> {
    const site = this.sites.get(siteId);
    if (!site) throw new Error('Site not found');
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const user = site.siteUser || site.id.replace(/[^a-z0-9_]/g, '_').slice(0, 32);
    await systemUserService.setPassword(user, password);
  }

  public async deleteSite(siteId: string): Promise<boolean> {
    const site = this.sites.get(siteId);
    if (!site) return false;

    // Stop and delete PM2 process
    await pm2Service.deleteApp(siteId);

    // Remove Nginx vhost
    await nginxService.removeVhost(site.domain);

    // Remove databases associated with site
    const dbs = mariaDbService.getDatabasesForSite(siteId);
    for (const db of dbs) {
      await mariaDbService.deleteDatabase(db.id);
    }

    // Remove from DB
    this.sites.delete(siteId);
    await this.saveDb();
    return true;
  }
}

export const sitesService = new SitesService();
