import type { 
  Site, 
  SystemStats, 
  CreateSitePayload, 
  FileItem, 
  FileContentResponse, 
  SiteDatabase, 
  CreateDatabasePayload,
  DatabaseTableInfo,
  DatabaseTableColumn,
  DatabaseQueryResult,
  DatabaseTableDataResponse,
  SafeUser,
  PanelSettings,
  SetupPayload,
  AuthStatusResponse
} from '../../../shared/types.js';

const API_BASE = '/api';

export const getAuthToken = (): string | null => localStorage.getItem('zoompanel_token');
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('zoompanel_token', token);
  } else {
    localStorage.removeItem('zoompanel_token');
  }
};

const getHeaders = (extra: Record<string, string> = {}) => {
  const headers: Record<string, string> = { ...extra };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  async getStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch system stats');
    return res.json();
  },

  async getUsedPorts(): Promise<{ port: number; siteId?: string; domain?: string }[]> {
    const res = await fetch(`${API_BASE}/ports/used`);
    if (!res.ok) throw new Error('Failed to fetch used ports');
    return res.json();
  },

  async getNextPort(): Promise<number> {
    const res = await fetch(`${API_BASE}/ports/next`);
    if (!res.ok) throw new Error('Failed to fetch next port');
    const data = await res.json();
    return data.nextPort;
  },

  async getSites(): Promise<Site[]> {
    const res = await fetch(`${API_BASE}/sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    return res.json();
  },

  async getSite(id: string): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites/${id}`);
    if (!res.ok) throw new Error('Failed to fetch site details');
    return res.json();
  },

  async createSite(payload: CreateSitePayload): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create site' }));
      throw new Error(err.error || 'Failed to create site');
    }
    return res.json();
  },

  async updateSiteStatus(id: string, status: 'running' | 'stopped' | 'restarting'): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update site status');
    return res.json();
  },

  async toggleDatabases(siteId: string, enabled: boolean): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/databases-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to toggle databases' }));
      throw new Error(err.error || 'Failed to toggle databases');
    }
    return res.json();
  },

  async getDatabases(siteId: string): Promise<SiteDatabase[]> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/databases`);
    if (!res.ok) throw new Error('Failed to fetch databases');
    return res.json();
  },

  async createDatabase(payload: CreateDatabasePayload): Promise<SiteDatabase> {
    const res = await fetch(`${API_BASE}/sites/${payload.siteId}/databases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create database' }));
      throw new Error(err.error || 'Failed to create database');
    }
    return res.json();
  },

  async deleteDatabase(siteId: string, dbId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/databases/${encodeURIComponent(dbId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete database');
  },

  // Database Admin API
  async getDatabaseTables(dbName: string): Promise<DatabaseTableInfo[]> {
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/tables`);
    if (!res.ok) throw new Error('Failed to fetch database tables');
    return res.json();
  },

  async getTableStructure(dbName: string, tableName: string): Promise<DatabaseTableColumn[]> {
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/tables/${encodeURIComponent(tableName)}/structure`);
    if (!res.ok) throw new Error('Failed to fetch table structure');
    return res.json();
  },

  async getTableData(
    dbName: string,
    tableName: string,
    page = 1,
    limit = 50,
    sortCol?: string,
    sortDir: 'asc' | 'desc' = 'asc'
  ): Promise<DatabaseTableDataResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sortDir });
    if (sortCol) params.append('sortCol', sortCol);
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/tables/${encodeURIComponent(tableName)}/data?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch table data');
    return res.json();
  },

  async executeDatabaseQuery(dbName: string, sql: string): Promise<DatabaseQueryResult> {
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) throw new Error('Failed to execute query');
    return res.json();
  },

  async insertTableRow(dbName: string, tableName: string, rowData: Record<string, any>): Promise<any> {
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/tables/${encodeURIComponent(tableName)}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rowData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to insert row' }));
      throw new Error(err.error || 'Failed to insert row');
    }
    return res.json();
  },

  async deleteTableRow(dbName: string, tableName: string, pkCol: string, pkVal: any): Promise<void> {
    const params = new URLSearchParams({ pkCol, pkVal: String(pkVal) });
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/tables/${encodeURIComponent(tableName)}/rows?${params.toString()}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete row');
  },

  async updateTableRow(
    dbName: string,
    tableName: string,
    pkCol: string,
    pkVal: any,
    updatedData: Record<string, any>
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/databases/${encodeURIComponent(dbName)}/tables/${encodeURIComponent(tableName)}/rows`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pkCol, pkVal, updatedData }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update row' }));
      throw new Error(err.error || 'Failed to update row');
    }
    return res.json();
  },

  async deleteSite(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sites/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete site');
  },

  async updateSitePort(id: string, port: number): Promise<Site> {
    const res = await fetch(`${API_BASE}/sites/${id}/port`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update site port' }));
      throw new Error(err.error || 'Failed to update site port');
    }
    return res.json();
  },

  async getSiteLogs(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/sites/${id}/logs`);
    if (!res.ok) throw new Error('Failed to fetch logs');
    const data = await res.json();
    return data.logs;
  },

  async getSystemLogs(service?: string): Promise<{ logs: string; timestamp: string }> {
    const q = service ? `?service=${encodeURIComponent(service)}` : '';
    const res = await fetch(`${API_BASE}/system/logs${q}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch system logs');
    return res.json();
  },

  async restartService(name: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(name)}/restart`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to restart service' }));
      throw new Error(err.error || 'Failed to restart service');
    }
    return res.json();
  },

  async startService(name: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(name)}/start`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to start service' }));
      throw new Error(err.error || 'Failed to start service');
    }
    return res.json();
  },

  async stopService(name: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(name)}/stop`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to stop service' }));
      throw new Error(err.error || 'Failed to stop service');
    }
    return res.json();
  },

  async toggleService(name: string, action?: 'start' | 'stop'): Promise<{ success: boolean; message: string; running: boolean }> {
    const res = await fetch(`${API_BASE}/services/${encodeURIComponent(name)}/toggle`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to toggle service' }));
      throw new Error(err.error || 'Failed to toggle service');
    }
    return res.json();
  },

  async updateSftpPort(port: number): Promise<{ success: boolean; port: number; message: string }> {
    const res = await fetch(`${API_BASE}/services/sftp/port`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ port }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update SFTP port' }));
      throw new Error(err.error || 'Failed to update SFTP port');
    }
    return res.json();
  },

  async getNginxConfig(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/sites/${id}/nginx-config`);
    if (!res.ok) throw new Error('Failed to fetch NGINX config');
    const data = await res.json();
    return data.config;
  },

  async saveNginxConfig(id: string, config: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/sites/${id}/nginx-config`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ config }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save NGINX configuration' }));
      throw new Error(err.error || 'Failed to save NGINX configuration');
    }
    return res.json();
  },

  async resetNginxConfig(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/sites/${id}/nginx-config/reset`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reset NGINX configuration' }));
      throw new Error(err.error || 'Failed to reset NGINX configuration');
    }
    const data = await res.json();
    return data.config;
  },

  async listFiles(path?: string, root?: string): Promise<{ path: string; items: FileItem[] }> {
    const params = new URLSearchParams();
    if (path) params.append('path', path);
    if (root) params.append('root', root);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/files/list${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to list files' }));
      throw new Error(err.error || 'Failed to list files');
    }
    return res.json();
  },

  async readFile(path: string, root?: string): Promise<FileContentResponse> {
    const params = new URLSearchParams({ path });
    if (root) params.append('root', root);
    const res = await fetch(`${API_BASE}/files/read?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to read file');
    return res.json();
  },

  async saveFile(path: string, content: string, root?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/files/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save file' }));
      throw new Error(err.error || 'Failed to save file');
    }
  },

  async createDirectory(path: string, root?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/files/create-dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create directory' }));
      throw new Error(err.error || 'Failed to create directory');
    }
  },

  async renameFile(oldPath: string, newPath: string, root?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to rename item' }));
      throw new Error(err.error || 'Failed to rename item');
    }
  },

  async deleteFile(path: string, root?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete file' }));
      throw new Error(err.error || 'Failed to delete file');
    }
  },

  async bulkDeleteFiles(paths: string[], root?: string): Promise<{ success: boolean; count: number }> {
    const res = await fetch(`${API_BASE}/files/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete selected files' }));
      throw new Error(err.error || 'Failed to delete selected files');
    }
    return res.json();
  },

  async checkMoveConflicts(sources: string[], destination: string, root?: string): Promise<{ conflicts: string[] }> {
    const res = await fetch(`${API_BASE}/files/move-conflicts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources, destination, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to check move conflicts' }));
      throw new Error(err.error || 'Failed to check move conflicts');
    }
    return res.json();
  },

  async moveFiles(sources: string[], destination: string, overwrite?: boolean, root?: string): Promise<{ success: boolean; moved: string[] }> {
    const res = await fetch(`${API_BASE}/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources, destination, overwrite, root }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to move items' }));
      throw new Error(err.error || 'Failed to move items');
    }
    return res.json();
  },

  // Auth, Setup & Settings API
  async getAuthStatus(): Promise<AuthStatusResponse> {
    const res = await fetch(`${API_BASE}/auth/status`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get auth status');
    return res.json();
  },

  async setup(payload: SetupPayload): Promise<{ user: SafeUser; settings: PanelSettings }> {
    const res = await fetch(`${API_BASE}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Setup failed' }));
      throw new Error(err.error || 'Setup failed');
    }
    return res.json();
  },

  async login(username: string, password: string): Promise<{ token: string; user: SafeUser }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid credentials' }));
      throw new Error(err.error || 'Invalid credentials');
    }
    const data = await res.json();
    setAuthToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } finally {
      setAuthToken(null);
    }
  },

  async getTimezones(): Promise<{ id: string; label: string; offset: string }[]> {
    const res = await fetch(`${API_BASE}/timezones`);
    if (!res.ok) throw new Error('Failed to fetch timezones');
    return res.json();
  },

  async getSettings(): Promise<PanelSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get panel settings');
    return res.json();
  },

  async updateSettings(settings: Partial<PanelSettings>): Promise<PanelSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update settings' }));
      throw new Error(err.error || 'Failed to update settings');
    }
    return res.json();
  },

  // SSL Certificate Actions
  async addSelfSignedCert(siteId: string): Promise<{ success: boolean; ssl: any; site: any }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/ssl/self-signed`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to generate self-signed certificate' }));
      throw new Error(err.error || 'Failed to generate self-signed certificate');
    }
    return res.json();
  },

  async addLetsEncryptCert(siteId: string, email?: string): Promise<{ success: boolean; ssl: any; site: any }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/ssl/letsencrypt`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Failed to issue Let's Encrypt certificate" }));
      throw new Error(err.error || "Failed to issue Let's Encrypt certificate");
    }
    return res.json();
  },

  async importCustomCert(siteId: string, cert: string, key: string): Promise<{ success: boolean; ssl: any; site: any }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/ssl/import`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ cert, key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to import certificate' }));
      throw new Error(err.error || 'Failed to import certificate');
    }
    return res.json();
  },

  async deleteSiteSsl(siteId: string): Promise<{ success: boolean; ssl: any; site: any }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/ssl`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove certificate' }));
      throw new Error(err.error || 'Failed to remove certificate');
    }
    return res.json();
  },

  // Site User & SSH Key Methods
  async addSshKey(siteId: string, publicKey: string): Promise<{ success: boolean; site: any; sshKeys: string[] }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/ssh-keys`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ publicKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add SSH key' }));
      throw new Error(err.error || 'Failed to add SSH key');
    }
    return res.json();
  },

  async removeSshKey(siteId: string, publicKey: string): Promise<{ success: boolean; site: any; sshKeys: string[] }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/ssh-keys`, {
      method: 'DELETE',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ publicKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove SSH key' }));
      throw new Error(err.error || 'Failed to remove SSH key');
    }
    return res.json();
  },

  async resetSiteUserPassword(siteId: string, password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/sites/${siteId}/site-user-password`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update user password' }));
      throw new Error(err.error || 'Failed to update user password');
    }
    return res.json();
  },
};
