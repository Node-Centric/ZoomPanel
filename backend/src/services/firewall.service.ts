import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { 
  FirewallRule, 
  CreateFirewallRulePayload, 
  UpdateFirewallRulePayload, 
  FirewallStatus, 
  FirewallProtocol,
  FirewallIpVersion
} from '../../../shared/types.js';
import { sitesService, DAEMON_PORT } from './sites.service.js';

const execAsync = promisify(exec);

export class FirewallService {
  private storePath: string;
  private rules: Map<string, FirewallRule> = new Map();
  private isLinux: boolean;

  constructor() {
    this.storePath = path.resolve(process.cwd(), 'data', 'firewall.json');
    this.isLinux = process.platform === 'linux';
  }

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    try {
      const data = await fs.readFile(this.storePath, 'utf-8');
      const list: FirewallRule[] = JSON.parse(data);
      this.rules.clear();
      list.forEach((r) => this.rules.set(r.id, r));

      // Ensure ZoomPanel daemon port rules exist even if older store was loaded
      const hasZoomPanel = Array.from(this.rules.values()).some(
        (r) => r.name.toLowerCase() === 'zoompanel' || r.isCore
      );
      if (!hasZoomPanel) {
        this.addDefaultRules();
        await this.saveStore();
      }
    } catch {
      this.rules.clear();
      this.addDefaultRules();
      await this.saveStore();
    }
  }

  private addDefaultRules(): void {
    const currentDaemonPort = sitesService.getDaemonPort() || DAEMON_PORT;
    const now = new Date().toISOString();

    const defaults: FirewallRule[] = [
      // ZoomPanel Daemon Rules (Enabled by default, Core Protection)
      {
        id: 'rule-zoompanel-v4',
        name: 'ZoomPanel',
        description: 'ZoomPanel Web GUI & Management API (IPv4)',
        port: String(currentDaemonPort),
        protocol: 'tcp',
        ipVersion: 'ipv4',
        source: 'Anywhere (0.0.0.0/0)',
        enabled: true,
        action: 'allow',
        isCore: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-zoompanel-v6',
        name: 'ZoomPanel',
        description: 'ZoomPanel Web GUI & Management API (IPv6)',
        port: String(currentDaemonPort),
        protocol: 'tcp',
        ipVersion: 'ipv6',
        source: 'Anywhere (::/0)',
        enabled: true,
        action: 'allow',
        isCore: true,
        createdAt: now,
        updatedAt: now,
      },
      // HTTP Port 80 (Enabled by default for both protocols)
      {
        id: 'rule-http-v4',
        name: 'HTTP',
        description: 'Standard HTTP Web Traffic (IPv4)',
        port: '80',
        protocol: 'tcp',
        ipVersion: 'ipv4',
        source: 'Anywhere (0.0.0.0/0)',
        enabled: true,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-http-v6',
        name: 'HTTP',
        description: 'Standard HTTP Web Traffic (IPv6)',
        port: '80',
        protocol: 'tcp',
        ipVersion: 'ipv6',
        source: 'Anywhere (::/0)',
        enabled: true,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      // HTTPS Port 443 (Enabled by default for both protocols)
      {
        id: 'rule-https-v4',
        name: 'HTTPS',
        description: 'Secure Encrypted HTTPS Web Traffic (IPv4)',
        port: '443',
        protocol: 'tcp',
        ipVersion: 'ipv4',
        source: 'Anywhere (0.0.0.0/0)',
        enabled: true,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-https-v6',
        name: 'HTTPS',
        description: 'Secure Encrypted HTTPS Web Traffic (IPv6)',
        port: '443',
        protocol: 'tcp',
        ipVersion: 'ipv6',
        source: 'Anywhere (::/0)',
        enabled: true,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      // SSH / SFTP Port 22 (Disabled by default for both protocols)
      {
        id: 'rule-ssh-v4',
        name: 'SSH / SFTP',
        description: 'Remote SSH Terminal & SFTP Access (IPv4)',
        port: '22',
        protocol: 'tcp',
        ipVersion: 'ipv4',
        source: 'Anywhere (0.0.0.0/0)',
        enabled: true,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-ssh-v6',
        name: 'SSH / SFTP',
        description: 'Remote SSH Terminal & SFTP Access (IPv6)',
        port: '22',
        protocol: 'tcp',
        ipVersion: 'ipv6',
        source: 'Anywhere (::/0)',
        enabled: true,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      // MariaDB Port 3306 (Disabled by default for both protocols)
      {
        id: 'rule-mariadb-v4',
        name: 'MariaDB',
        description: 'MariaDB Remote SQL Database Listener (IPv4)',
        port: '3306',
        protocol: 'tcp',
        ipVersion: 'ipv4',
        source: 'Anywhere (0.0.0.0/0)',
        enabled: false,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'rule-mariadb-v6',
        name: 'MariaDB',
        description: 'MariaDB Remote SQL Database Listener (IPv6)',
        port: '3306',
        protocol: 'tcp',
        ipVersion: 'ipv6',
        source: 'Anywhere (::/0)',
        enabled: false,
        action: 'allow',
        createdAt: now,
        updatedAt: now,
      },
    ];

    defaults.forEach((r) => this.rules.set(r.id, r));
  }

  private async saveStore(): Promise<void> {
    const list = Array.from(this.rules.values());
    await fs.writeFile(this.storePath, JSON.stringify(list, null, 2), 'utf-8');
  }

  public getAllRules(): FirewallRule[] {
    return Array.from(this.rules.values());
  }

  public getRuleById(id: string): FirewallRule | undefined {
    return this.rules.get(id);
  }

  public async getStatus(): Promise<FirewallStatus> {
    const rules = this.getAllRules();
    const activeCount = rules.filter((r) => r.enabled).length;
    const daemonPort = sitesService.getDaemonPort() || DAEMON_PORT;
    return {
      enabled: true,
      rulesCount: rules.length,
      activeCount,
      daemonPort,
      rules,
    };
  }

  public async createRule(payload: CreateFirewallRulePayload): Promise<FirewallRule[]> {
    if (!payload.name || !payload.port) {
      throw new Error('Rule name and port are required.');
    }

    const cleanPort = payload.port.trim();
    const protocol: FirewallProtocol = payload.protocol || 'tcp';
    const action = payload.action || 'allow';
    const enabled = payload.enabled !== undefined ? payload.enabled : true;
    const now = new Date().toISOString();

    const created: FirewallRule[] = [];

    const versions: FirewallIpVersion[] = 
      payload.ipVersion === 'both' ? ['ipv4', 'ipv6'] : [payload.ipVersion as FirewallIpVersion];

    for (const ver of versions) {
      const isV4 = ver === 'ipv4';
      let source = payload.source?.trim();
      if (!source || source.toLowerCase() === 'anywhere') {
        source = isV4 ? 'Anywhere (0.0.0.0/0)' : 'Anywhere (::/0)';
      }

      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const isZoomPanelName = payload.name.trim().toLowerCase() === 'zoompanel';

      const rule: FirewallRule = {
        id: `rule-${Date.now()}-${ver}-${randomSuffix}`,
        name: payload.name.trim(),
        description: payload.description?.trim() || `${payload.name.trim()} (${ver.toUpperCase()})`,
        port: cleanPort,
        protocol,
        ipVersion: ver,
        source,
        enabled,
        action,
        isCore: isZoomPanelName,
        createdAt: now,
        updatedAt: now,
      };

      this.rules.set(rule.id, rule);
      created.push(rule);

      if (enabled && this.isLinux) {
        await this.syncUfwRule(rule, 'allow').catch((err) => {
          console.error('[Firewall] UFW sync error:', err.message);
        });
      }
    }

    await this.saveStore();
    return created;
  }

  public async updateRule(id: string, payload: UpdateFirewallRulePayload): Promise<FirewallRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found.`);
    }

    const prevPort = rule.port;
    const prevEnabled = rule.enabled;

    if (payload.name !== undefined) rule.name = payload.name.trim();
    if (payload.description !== undefined) rule.description = payload.description.trim();
    if (payload.port !== undefined) rule.port = payload.port.trim();
    if (payload.protocol !== undefined) rule.protocol = payload.protocol;
    if (payload.ipVersion !== undefined) rule.ipVersion = payload.ipVersion;
    if (payload.source !== undefined) rule.source = payload.source.trim();
    if (payload.action !== undefined) rule.action = payload.action;
    if (payload.enabled !== undefined) rule.enabled = payload.enabled;
    rule.updatedAt = new Date().toISOString();

    // If ZoomPanel daemon rule port changed, synchronize all ZoomPanel rules
    if ((rule.isCore || rule.name.toLowerCase() === 'zoompanel') && payload.port && payload.port !== prevPort) {
      const newPortNum = parseInt(rule.port, 10);
      if (!isNaN(newPortNum)) {
        sitesService.setDaemonPort(newPortNum);
        for (const other of this.rules.values()) {
          if ((other.isCore || other.name.toLowerCase() === 'zoompanel') && other.id !== rule.id) {
            other.port = rule.port;
            other.updatedAt = rule.updatedAt;
          }
        }
      }
    }

    if (this.isLinux) {
      if (prevEnabled) {
        await this.syncUfwRule({ ...rule, port: prevPort }, 'delete').catch(() => {});
      }
      if (rule.enabled) {
        await this.syncUfwRule(rule, 'allow').catch((err) => {
          console.error('[Firewall] UFW sync error on update:', err.message);
        });
      }
    }

    await this.saveStore();
    return rule;
  }

  public async toggleRule(id: string, explicitState?: boolean): Promise<FirewallRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found.`);
    }

    const nextState = explicitState !== undefined ? explicitState : !rule.enabled;
    rule.enabled = nextState;
    rule.updatedAt = new Date().toISOString();

    if (this.isLinux) {
      if (rule.enabled) {
        await this.syncUfwRule(rule, 'allow').catch((err) => {
          console.error('[Firewall] UFW allow error:', err.message);
        });
      } else {
        await this.syncUfwRule(rule, 'delete').catch((err) => {
          console.error('[Firewall] UFW delete error:', err.message);
        });
      }
    }

    await this.saveStore();
    return rule;
  }

  public async deleteRule(id: string, force = false): Promise<boolean> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found.`);
    }

    if ((rule.isCore || rule.name.toLowerCase() === 'zoompanel') && !force) {
      throw new Error(
        'Deleting the ZoomPanel daemon port rule requires explicit confirmation to prevent panel lockout.'
      );
    }

    if (this.isLinux && rule.enabled) {
      await this.syncUfwRule(rule, 'delete').catch((err) => {
        console.error('[Firewall] UFW delete rule error:', err.message);
      });
    }

    this.rules.delete(id);
    await this.saveStore();
    return true;
  }

  public async syncDaemonPort(newPort: number): Promise<void> {
    if (!newPort || isNaN(newPort)) return;
    const strPort = String(newPort);
    let changed = false;

    for (const rule of this.rules.values()) {
      if (rule.isCore || rule.name.toLowerCase() === 'zoompanel') {
        const prevPort = rule.port;
        if (prevPort !== strPort) {
          if (this.isLinux && rule.enabled) {
            await this.syncUfwRule({ ...rule, port: prevPort }, 'delete').catch(() => {});
          }

          rule.port = strPort;
          rule.updatedAt = new Date().toISOString();
          changed = true;

          if (this.isLinux && rule.enabled) {
            await this.syncUfwRule(rule, 'allow').catch((err) => {
              console.error('[Firewall] UFW syncDaemonPort error:', err.message);
            });
          }
        }
      }
    }

    if (changed) {
      await this.saveStore();
    }
  }

  private async syncUfwRule(rule: FirewallRule, op: 'allow' | 'delete'): Promise<void> {
    if (!this.isLinux) return;

    try {
      // Format port for UFW: port ranges e.g. 3000-3050 become 3000:3050
      const ufwPort = rule.port.replace(/-/g, ':');
      const proto = rule.protocol === 'any' ? '' : `/${rule.protocol}`;

      // Check if source is restricted or anywhere
      const isAnywhere = 
        rule.source.toLowerCase().includes('anywhere') || 
        rule.source === '0.0.0.0/0' || 
        rule.source === '::/0';

      let cmd = '';
      if (op === 'allow') {
        if (isAnywhere) {
          cmd = `ufw allow ${ufwPort}${proto}`;
        } else {
          // Extract bare IP or CIDR if contained in parentheses
          const match = rule.source.match(/\(([^)]+)\)/);
          const rawSource = match ? match[1] : rule.source.trim();
          cmd = `ufw allow from ${rawSource} to any port ${ufwPort}${proto}`;
        }
      } else {
        if (isAnywhere) {
          cmd = `ufw delete allow ${ufwPort}${proto} || true`;
        } else {
          const match = rule.source.match(/\(([^)]+)\)/);
          const rawSource = match ? match[1] : rule.source.trim();
          cmd = `ufw delete allow from ${rawSource} to any port ${ufwPort}${proto} || true`;
        }
      }

      await execAsync(cmd);
    } catch (err: any) {
      console.warn(`[Firewall] Failed to execute UFW command for ${rule.name}:`, err.message);
    }
  }
}

export const firewallService = new FirewallService();
