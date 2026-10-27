import { Router } from 'express';
import path from 'path';
import { systemService } from '../services/system.service.js';
import { sitesService } from '../services/sites.service.js';
import { pm2Service } from '../services/pm2.service.js';
import { nginxService } from '../services/nginx.service.js';
import { filesService } from '../services/files.service.js';
import { mariaDbService } from '../services/mariadb.service.js';
import { authService } from '../services/auth.service.js';
import { sslService } from '../services/ssl.service.js';

export const apiRouter = Router();

// Auth & Setup Routes
apiRouter.get('/auth/status', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '');
  const user = authService.validateToken(token);
  const isInitialized = authService.isInitialized();
  res.json({
    isInitialized,
    isAuthenticated: Boolean(user),
    user: user || null,
    settings: authService.getSettings(),
  });
});

apiRouter.post('/setup', async (req, res) => {
  try {
    const result = await authService.setup(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const result = await authService.login(username, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '');
  authService.logout(token);
  res.json({ success: true });
});

apiRouter.get('/timezones', (req, res) => {
  const list = authService.getTimezones();
  res.json(list);
});

apiRouter.get('/settings', (req, res) => {
  res.json(authService.getSettings());
});

apiRouter.post('/settings', async (req, res) => {
  try {
    const updated = await authService.updateSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Sandbox helper to prevent accessing files outside root level
function checkSandbox(targetPath: string, rootPath?: string): string {
  if (!rootPath) return path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.toLowerCase().startsWith(resolvedRoot.toLowerCase())) {
    throw new Error('Access denied: Path is outside the site root directory');
  }
  return resolvedTarget;
}

// System stats
apiRouter.get('/stats', async (req, res) => {
  try {
    const stats = await systemService.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Logs
apiRouter.get('/system/logs', async (req, res) => {
  try {
    const service = req.query.service as string | undefined;
    const data = await systemService.getSystemLogs(service);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restart Daemon Service
apiRouter.post('/services/:name/restart', async (req, res) => {
  try {
    const serviceName = req.params.name.toLowerCase();
    const result = await systemService.restartService(serviceName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start Daemon Service
apiRouter.post('/services/:name/start', async (req, res) => {
  try {
    const serviceName = req.params.name.toLowerCase();
    const result = await systemService.startService(serviceName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop Daemon Service
apiRouter.post('/services/:name/stop', async (req, res) => {
  try {
    const serviceName = req.params.name.toLowerCase();
    const result = await systemService.stopService(serviceName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Daemon Service
apiRouter.post('/services/:name/toggle', async (req, res) => {
  try {
    const serviceName = req.params.name.toLowerCase();
    const { action } = req.body || {};
    const result = await systemService.toggleService(serviceName, action);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update SFTP Service Port
apiRouter.post('/services/sftp/port', async (req, res) => {
  try {
    const { port } = req.body;
    const numPort = Number(port);
    if (!numPort || isNaN(numPort)) {
      return res.status(400).json({ error: 'Valid port number is required.' });
    }
    const result = await systemService.updateSftpPort(numPort);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Ports info
apiRouter.get('/ports/used', (req, res) => {
  const used = sitesService.getUsedPorts();
  res.json(used);
});

apiRouter.get('/ports/next', (req, res) => {
  const nextPort = sitesService.getNextAvailablePort();
  res.json({ nextPort });
});

// Sites CRUD
apiRouter.get('/sites', (req, res) => {
  const sites = sitesService.getAllSites();
  res.json(sites);
});

apiRouter.get('/sites/:id', (req, res) => {
  const site = sitesService.getSiteById(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json(site);
});

apiRouter.post('/sites', async (req, res) => {
  try {
    const site = await sitesService.createSite(req.body);
    res.status(201).json(site);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const site = await sitesService.updateSiteStatus(req.params.id, status);
    res.json(site);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/port', async (req, res) => {
  try {
    const { port } = req.body;
    const site = await sitesService.updateSitePort(req.params.id, port);
    res.json(site);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/sites/:id/port', async (req, res) => {
  try {
    const { port } = req.body;
    const site = await sitesService.updateSitePort(req.params.id, port);
    res.json(site);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/databases-toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    const site = await sitesService.setDatabasesEnabled(req.params.id, Boolean(enabled));
    res.json(site);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Site User Password & SSH Keys
apiRouter.post('/sites/:id/site-user-password', async (req, res) => {
  try {
    const { password } = req.body;
    await sitesService.resetSiteUserPassword(req.params.id, password);
    res.json({ success: true, message: 'Site user password updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/ssh-keys', async (req, res) => {
  try {
    const { publicKey } = req.body;
    const site = await sitesService.addSshKey(req.params.id, publicKey);
    res.json({ success: true, site, sshKeys: site.sshKeys || [] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/sites/:id/ssh-keys', async (req, res) => {
  try {
    const { publicKey } = req.body;
    const site = await sitesService.removeSshKey(req.params.id, publicKey);
    res.json({ success: true, site, sshKeys: site.sshKeys || [] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/sites/:id', async (req, res) => {
  try {
    const success = await sitesService.deleteSite(req.params.id);
    if (!success) return res.status(404).json({ error: 'Site not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Databases endpoints for site
apiRouter.get('/sites/:id/databases', (req, res) => {
  const dbs = mariaDbService.getDatabasesForSite(req.params.id);
  res.json(dbs);
});

apiRouter.post('/sites/:id/databases', async (req, res) => {
  try {
    const db = await mariaDbService.createDatabase({
      siteId: req.params.id,
      name: req.body.name,
      user: req.body.user,
      password: req.body.password,
      charset: req.body.charset,
    });
    res.status(201).json(db);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/sites/:id/databases/:dbId', async (req, res) => {
  try {
    const success = await mariaDbService.deleteDatabase(req.params.dbId);
    if (!success) return res.status(404).json({ error: 'Database not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Database Admin routes (custom UI support)
apiRouter.get('/databases/:dbName/tables', async (req, res) => {
  try {
    const tables = await mariaDbService.getTables(req.params.dbName);
    res.json(tables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/databases/:dbName/tables/:tableName/structure', async (req, res) => {
  try {
    const structure = await mariaDbService.getTableStructure(req.params.dbName, req.params.tableName);
    res.json(structure);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/databases/:dbName/tables/:tableName/data', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const sortCol = req.query.sortCol as string | undefined;
    const sortDir = (req.query.sortDir as 'asc' | 'desc') || 'asc';
    const data = await mariaDbService.getTableData(req.params.dbName, req.params.tableName, page, limit, sortCol, sortDir);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/databases/:dbName/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL query string is required' });
    const result = await mariaDbService.executeQuery(req.params.dbName, sql);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/databases/:dbName/tables/:tableName/rows', async (req, res) => {
  try {
    const result = await mariaDbService.insertRow(req.params.dbName, req.params.tableName, req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/databases/:dbName/tables/:tableName/rows', async (req, res) => {
  try {
    const { pkCol, pkVal } = req.query;
    if (!pkCol || pkVal === undefined) {
      return res.status(400).json({ error: 'pkCol and pkVal query parameters are required' });
    }
    const success = await mariaDbService.deleteRow(req.params.dbName, req.params.tableName, String(pkCol), pkVal);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/databases/:dbName/tables/:tableName/rows', async (req, res) => {
  try {
    const { pkCol, pkVal, updatedData } = req.body;
    if (!pkCol || pkVal === undefined || !updatedData) {
      return res.status(400).json({ error: 'pkCol, pkVal, and updatedData are required' });
    }
    const result = await mariaDbService.updateRow(req.params.dbName, req.params.tableName, String(pkCol), pkVal, updatedData);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Logs & NGINX
apiRouter.get('/sites/:id/logs', async (req, res) => {
  try {
    const logs = await pm2Service.getAppLogs(req.params.id);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/sites/:id/nginx-config', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const config = await nginxService.getVhostConfig(site);
    res.json({ config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/nginx-config', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const { config } = req.body;
    if (typeof config !== 'string') {
      return res.status(400).json({ error: 'Configuration content is required' });
    }
    const result = await nginxService.saveVhostConfig(site, config);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/nginx-config/reset', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const config = nginxService.generateConfigString(site);
    await nginxService.saveVhostConfig(site, config);
    res.json({ config, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSL Certificate routes
apiRouter.post('/sites/:id/ssl/self-signed', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const ssl = await sslService.generateSelfSignedCert(site.domain);
    const updated = await sitesService.updateSiteSsl(site.id, ssl);
    res.json({ success: true, ssl: updated.ssl, site: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/ssl/letsencrypt', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const { email } = req.body;
    const ssl = await sslService.generateLetsEncryptCert(site.domain, email);
    const updated = await sitesService.updateSiteSsl(site.id, ssl);
    res.json({ success: true, ssl: updated.ssl, site: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/ssl/import', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const { cert, key } = req.body;
    if (!cert || !key) {
      return res.status(400).json({ error: 'Certificate and Private Key content are required' });
    }
    const ssl = await sslService.importCustomCert(site.domain, cert, key);
    const updated = await sitesService.updateSiteSsl(site.id, ssl);
    res.json({ success: true, ssl: updated.ssl, site: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/sites/:id/ssl', async (req, res) => {
  try {
    const site = sitesService.getSiteById(req.params.id);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const updated = await sitesService.deleteSiteSsl(site.id);
    res.json({ success: true, ssl: updated.ssl, site: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Site User & SSH Key routes
apiRouter.post('/sites/:id/ssh-keys', async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'Public key is required' });
    }
    const updated = await sitesService.addSshKey(req.params.id, publicKey.trim());
    res.json({ success: true, site: updated, sshKeys: updated.sshKeys });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/sites/:id/ssh-keys', async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'Public key is required' });
    }
    const updated = await sitesService.removeSshKey(req.params.id, publicKey.trim());
    res.json({ success: true, site: updated, sshKeys: updated.sshKeys });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/sites/:id/site-user-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }
    await sitesService.resetSiteUserPassword(req.params.id, password);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// File Manager routes with Sandboxing support
apiRouter.get('/files/list', async (req, res) => {
  try {
    const rootPath = req.query.root as string | undefined;
    const requested = (req.query.path as string) || (rootPath ? rootPath : process.cwd());
    const targetPath = checkSandbox(requested, rootPath);
    const items = await filesService.listDirectory(targetPath);
    res.json({ path: targetPath, items });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/files/read', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    const rootPath = req.query.root as string | undefined;
    if (!filePath) return res.status(400).json({ error: 'Missing path query parameter' });
    const targetPath = checkSandbox(filePath, rootPath);
    const data = await filesService.readFile(targetPath);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/save', async (req, res) => {
  try {
    const { path: filePath, content, root } = req.body;
    const targetPath = checkSandbox(filePath, root);
    await filesService.saveFile(targetPath, content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/create-dir', async (req, res) => {
  try {
    const { path: dirPath, root } = req.body;
    const targetPath = checkSandbox(dirPath, root);
    await filesService.createDirectory(targetPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/delete', async (req, res) => {
  try {
    const { path: itemPath, root } = req.body;
    const targetPath = checkSandbox(itemPath, root);
    if (root && path.resolve(targetPath) === path.resolve(root)) {
      return res.status(400).json({ error: 'Cannot delete the site root directory' });
    }
    await filesService.deleteItem(targetPath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/rename', async (req, res) => {
  try {
    const { oldPath, newPath, root } = req.body;
    const targetOld = checkSandbox(oldPath, root);
    const targetNew = checkSandbox(newPath, root);
    if (root && path.resolve(targetOld).toLowerCase() === path.resolve(root).toLowerCase()) {
      return res.status(400).json({ error: 'Cannot rename the site root directory' });
    }
    await filesService.renameItem(targetOld, targetNew);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/move-conflicts', async (req, res) => {
  try {
    const { sources, destination, root } = req.body;
    if (!Array.isArray(sources) || !destination) {
      return res.status(400).json({ error: 'sources array and destination are required' });
    }
    const safeSources = sources.map((s: string) => checkSandbox(s, root));
    const safeDest = checkSandbox(destination, root);
    const conflicts = await filesService.checkMoveConflicts(safeSources, safeDest);
    res.json({ conflicts });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/move', async (req, res) => {
  try {
    const { sources, destination, overwrite, root } = req.body;
    if (!Array.isArray(sources) || !destination) {
      return res.status(400).json({ error: 'sources array and destination are required' });
    }
    const safeSources = sources.map((s: string) => checkSandbox(s, root));
    const safeDest = checkSandbox(destination, root);
    const result = await filesService.moveItems(safeSources, safeDest, Boolean(overwrite));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/files/bulk-delete', async (req, res) => {
  try {
    const { paths: itemPaths, root } = req.body;
    if (!Array.isArray(itemPaths) || itemPaths.length === 0) {
      return res.status(400).json({ error: 'paths array is required' });
    }
    const safePaths = itemPaths.map((p: string) => {
      const sp = checkSandbox(p, root);
      if (root && path.resolve(sp).toLowerCase() === path.resolve(root).toLowerCase()) {
        throw new Error('Cannot delete the site root directory');
      }
      return sp;
    });
    await filesService.bulkDelete(safePaths);
    res.json({ success: true, count: safePaths.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
