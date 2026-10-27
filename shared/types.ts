export type SiteType = 'nodejs';

export interface SiteTypeOption {
  id: SiteType;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  badge?: string;
  recommended?: boolean;
  features: string[];
}

export type SiteStatus = 'running' | 'stopped' | 'error' | 'restarting';

export interface SiteEnvVar {
  key: string;
  value: string;
}

export interface SiteSSL {
  type: 'self-signed' | 'letsencrypt' | 'custom' | 'none';
  domain: string;
  domains?: string[];
  certPath: string;
  keyPath: string;
  issuedAt?: string;
  expiresAt?: string;
  autoRenew: boolean;
  status: 'valid' | 'expired' | 'warning' | 'pending';
}

export interface SiteDatabase {
  id: string;
  siteId: string;
  name: string;
  user: string;
  password?: string;
  host: string;
  port: number;
  charset: string;
  sizeBytes?: number;
  createdAt: string;
}

export interface DatabaseTableColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string | null;
  extra?: string;
}

export interface DatabaseTableInfo {
  name: string;
  rowCount: number;
  dataSize: number;
  indexSize: number;
  engine: string;
  collation: string;
  columns?: DatabaseTableColumn[];
}

export interface DatabaseQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  affectedRows?: number;
  executionTimeMs: number;
  error?: string;
}

export interface DatabaseTableDataResponse {
  tableName: string;
  columns: DatabaseTableColumn[];
  rows: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
}

export interface Site {
  id: string;
  domain: string;
  aliases: string[];
  type: SiteType;
  status: SiteStatus;
  port: number;
  rootDirectory: string;
  homeDirectory?: string;
  entryFile: string;
  nodeVersion: string;
  createdAt: string;
  updatedAt: string;
  ssl: SiteSSL;
  env: Record<string, string>;
  databasesEnabled: boolean;
  databases?: SiteDatabase[];
  siteUser: string;
  sshKeys?: string[];
  // PM2 Process Info
  pm2: {
    pid?: number;
    name: string;
    uptime?: number; // seconds
    restarts?: number;
    memory?: number; // in bytes
    cpu?: number;    // percentage
  };
}

export interface CreateSitePayload {
  domain: string;
  aliases?: string[];
  type: SiteType;
  siteUser: string;
  sitePassword?: string;
  port?: number;
  entryFile?: string;
  nodeVersion?: string;
  env?: Record<string, string>;
  enableSSL?: boolean;
  sslType?: 'self-signed' | 'letsencrypt';
  enableDatabases?: boolean;
}

export interface CreateDatabasePayload {
  siteId: string;
  name: string;
  user: string;
  password?: string;
  charset?: string;
}

export interface SystemStats {
  os: {
    platform: string;
    distro: string;
    release: string;
    uptime: number; // seconds
    hostname: string;
    nodeVersion?: string;
    ip?: string;
  };
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    mount: string;
  };
  services: {
    nginx: boolean;
    pm2: boolean;
    mariadb: boolean;
    mariadbVersion?: string;
    sftp?: boolean;
    sftpPort?: number;
    daemonPort?: number;
  };
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  permissions: string;
  extension?: string;
}

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  isBinary: boolean;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isDefaultAdmin: boolean;
  createdAt: string;
}

export interface PanelSettings {
  initialized: boolean;
  timeZone: string;
  daemonPort?: number;
  configuredAt?: string;
}

export interface SetupPayload {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  timeZone: string;
}

export interface AuthStatusResponse {
  isInitialized: boolean;
  isAuthenticated: boolean;
  user?: SafeUser | null;
  settings: PanelSettings;
}

// Firewall / WAF Types
export type FirewallProtocol = 'tcp' | 'udp' | 'any';
export type FirewallIpVersion = 'ipv4' | 'ipv6';
export type FirewallAction = 'allow' | 'deny';

export interface FirewallRule {
  id: string;
  name: string;
  description: string;
  port: string;
  protocol: FirewallProtocol;
  ipVersion: FirewallIpVersion;
  source: string;
  enabled: boolean;
  action: FirewallAction;
  isCore?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFirewallRulePayload {
  name: string;
  description?: string;
  port: string;
  protocol?: FirewallProtocol;
  ipVersion: FirewallIpVersion | 'both';
  source?: string;
  enabled?: boolean;
  action?: FirewallAction;
}

export interface UpdateFirewallRulePayload {
  name?: string;
  description?: string;
  port?: string;
  protocol?: FirewallProtocol;
  ipVersion?: FirewallIpVersion;
  source?: string;
  enabled?: boolean;
  action?: FirewallAction;
}

export interface FirewallStatus {
  enabled: boolean;
  rulesCount: number;
  activeCount: number;
  daemonPort: number;
  rules: FirewallRule[];
}
