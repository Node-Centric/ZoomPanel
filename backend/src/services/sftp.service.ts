import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import ssh2 from 'ssh2';
import { systemUserService } from './system-user.service.js';
import { sitesService } from './sites.service.js';

const { Server, utils } = ssh2;
const { STATUS_CODE, OPEN_MODE, flagsToString } = utils.sftp;

export interface SftpServerStatus {
  running: boolean;
  port: number;
  hostKeyLoaded: boolean;
  activeConnections: number;
}

export class SftpService {
  private server: ssh2.Server | null = null;
  private port: number = 22;
  private running: boolean = false;
  private activeConnections: number = 0;
  private enabled: boolean = true;
  private hostPrivateKey: string | null = null;

  constructor() {
    this.loadState().catch(() => {});
  }

  private getStateFilePath(): string {
    return path.resolve(process.cwd(), 'data', 'sftp-state.json');
  }

  private getHostKeyPath(): string {
    return path.resolve(process.cwd(), 'data', 'ssh_host_rsa_key');
  }

  private async loadState(): Promise<void> {
    try {
      const content = await fsp.readFile(this.getStateFilePath(), 'utf-8');
      const data = JSON.parse(content);
      if (typeof data.enabled === 'boolean') {
        this.enabled = data.enabled;
      }
      if (typeof data.port === 'number') {
        this.port = data.port;
      }
    } catch {
      this.enabled = false;
      this.port = process.platform === 'linux' ? 2222 : 22;
    }
  }

  public async setPort(desiredPort: number): Promise<{ success: boolean; port: number; message: string }> {
    if (desiredPort < 1 || desiredPort > 65535) {
      throw new Error('Port must be between 1 and 65535.');
    }
    if (desiredPort === 8443) {
      throw new Error('Port 8443 is reserved for the ZoomPanel daemon.');
    }

    this.port = desiredPort;
    await this.saveState();

    if (this.running) {
      return this.restart(desiredPort);
    }
    return { success: true, port: this.port, message: `SFTP port updated to ${this.port}.` };
  }

  private async saveState(): Promise<void> {
    try {
      const filePath = this.getStateFilePath();
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(
        filePath,
        JSON.stringify({ enabled: this.enabled, port: this.port }, null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error('[SFTP Service] Failed to save state:', err);
    }
  }

  private async ensureHostKey(): Promise<string> {
    if (this.hostPrivateKey) return this.hostPrivateKey;

    const keyPath = this.getHostKeyPath();
    try {
      const existing = await fsp.readFile(keyPath, 'utf-8');
      if (existing && existing.includes('PRIVATE KEY')) {
        this.hostPrivateKey = existing;
        return this.hostPrivateKey;
      }
    } catch {}

    // Generate new RSA 2048-bit host key
    console.log('[SFTP Service] Generating new 2048-bit RSA host key...');
    const generated = utils.generateKeyPairSync('rsa', { bits: 2048 });
    this.hostPrivateKey = generated.private;

    try {
      await fsp.mkdir(path.dirname(keyPath), { recursive: true });
      await fsp.writeFile(keyPath, this.hostPrivateKey, { mode: 0o600 });
      console.log(`[SFTP Service] Saved host key to ${keyPath}`);
    } catch (err) {
      console.error('[SFTP Service] Could not save host key file:', err);
    }

    return this.hostPrivateKey;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getPort(): number {
    return this.port;
  }

  public getStatus(): SftpServerStatus {
    return {
      running: this.running,
      port: this.port,
      hostKeyLoaded: Boolean(this.hostPrivateKey),
      activeConnections: this.activeConnections,
    };
  }

  public async start(desiredPort?: number): Promise<{ success: boolean; port: number; message: string }> {
    if (this.running && this.server) {
      return { success: true, port: this.port, message: `SFTP service is already running on port ${this.port}.` };
    }

    this.enabled = true;
    await this.saveState();

    const hostKey = await this.ensureHostKey();
    const tryPort = desiredPort || this.port || 22;

    return new Promise((resolve, reject) => {
      const server = new Server(
        {
          hostKeys: [hostKey],
        },
        (client) => {
          this.activeConnections++;
          let authenticatedUser: string | null = null;

          client.on('error', (err) => {
            console.error('[SFTP Client Error]:', err.message);
          });

          client.on('close', () => {
            this.activeConnections = Math.max(0, this.activeConnections - 1);
          });

          // Authentication
          client.on('authentication', async (ctx) => {
            const username = ctx.username;

            // Check if username corresponds to any site user or admin
            const sites = sitesService.getAllSites();
            const matchedSite = sites.find((s) => s.siteUser === username);
            const isKnownUser = Boolean(matchedSite) || username === 'root' || username === 'admin';

            if (!isKnownUser) {
              return ctx.reject(['password', 'publickey']);
            }

            if (ctx.method === 'password') {
              const pass = ctx.password;
              try {
                // If user doesn't have an enrolled password yet, register it on first login
                const hasCred = await systemUserService.hasPassword(username);
                if (!hasCred) {
                  await systemUserService.setPassword(username, pass);
                  authenticatedUser = username;
                  return ctx.accept();
                }

                // Verify against saved credentials
                const valid = await systemUserService.verifyPassword(username, pass);
                if (valid) {
                  authenticatedUser = username;
                  return ctx.accept();
                }
              } catch (err) {
                console.error('[SFTP Auth Error]:', err);
              }
              return ctx.reject(['password', 'publickey']);
            }

            if (ctx.method === 'publickey') {
              try {
                const keys = await systemUserService.getSshKeys(username);
                if (keys.length > 0) {
                  const clientKey = ctx.key;
                  for (const keyStr of keys) {
                    try {
                      const parsed = utils.parseKey(keyStr);
                      if (parsed && 'getPublicSSH' in parsed) {
                        const parsedBuf = (parsed as any).getPublicSSH();
                        if (clientKey.data && Buffer.isBuffer(clientKey.data) && parsedBuf) {
                          if (clientKey.data.equals(parsedBuf)) {
                            if (ctx.signature) {
                              const verifier = (parsed as any).verify(
                                ctx.blob,
                                ctx.signature,
                                ctx.key.algo
                              );
                              if (verifier) {
                                authenticatedUser = username;
                                return ctx.accept();
                              }
                            } else {
                              return ctx.accept();
                            }
                          }
                        }
                      }
                    } catch {}
                  }
                }
              } catch (err) {
                console.error('[SFTP Public Key Error]:', err);
              }
              return ctx.reject(['password', 'publickey']);
            }

            return ctx.reject(['password', 'publickey']);
          });

          // Session & Subsystem
          client.on('ready', () => {
            client.on('session', (accept, reject) => {
              const session = accept();

              session.on('sftp', (accept, reject) => {
                const sftpStream = accept();
                const siteUser = authenticatedUser || 'unknown';
                const baseDir = systemUserService.getUserHomeDir(siteUser);

                // Ensure base directory exists
                try {
                  fs.mkdirSync(baseDir, { recursive: true });
                } catch {}

                const handles = new Map<number, { type: 'dir' | 'file'; path: string; fd?: number; entries?: any[]; returned?: boolean }>();
                let handleCount = 0;

                const resolveSafePath = (rawPath: string): string => {
                  let cleaned = (rawPath || '/').replace(/\\/g, '/');
                  // Strip leading slash for relative join
                  if (cleaned.startsWith('/')) {
                    cleaned = cleaned.slice(1);
                  }
                  const safeRel = path.normalize(cleaned).replace(/^(\.\.[\/\\])+/, '');
                  const resolved = path.resolve(baseDir, safeRel);
                  // Ensure cannot escape baseDir
                  if (!resolved.startsWith(baseDir)) {
                    return baseDir;
                  }
                  return resolved;
                };

                const toVirtualPath = (realPath: string): string => {
                  const rel = path.relative(baseDir, realPath).replace(/\\/g, '/');
                  return rel ? `/${rel}` : '/';
                };

                const toAttributes = (stats?: fs.Stats | null) => {
                  if (!stats) {
                    const now = Math.floor(Date.now() / 1000);
                    return {
                      mode: 0o100644,
                      uid: 1000,
                      gid: 1000,
                      size: 0,
                      atime: now,
                      mtime: now,
                    };
                  }
                  return {
                    mode: stats.mode,
                    uid: stats.uid || 1000,
                    gid: stats.gid || 1000,
                    size: stats.size,
                    atime: Math.floor(stats.atimeMs / 1000),
                    mtime: Math.floor(stats.mtimeMs / 1000),
                  };
                };

                // REALPATH
                sftpStream.on('REALPATH', (reqid: any, p: any) => {
                  const target = resolveSafePath(p);
                  const virt = toVirtualPath(target);
                  sftpStream.name(reqid, [{ filename: virt, longname: virt, attrs: toAttributes() as any }]);
                });

                // STAT
                sftpStream.on('STAT', (reqid: any, p: any) => {
                  const target = resolveSafePath(p);
                  fs.stat(target, (err, stats) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                    sftpStream.attrs(reqid, toAttributes(stats) as any);
                  });
                });

                // LSTAT
                sftpStream.on('LSTAT', (reqid: any, p: any) => {
                  const target = resolveSafePath(p);
                  fs.lstat(target, (err, stats) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                    sftpStream.attrs(reqid, toAttributes(stats) as any);
                  });
                });

                // OPENDIR
                sftpStream.on('OPENDIR', (reqid: any, p: any) => {
                  const target = resolveSafePath(p);
                  fs.stat(target, (err, stats) => {
                    if (err || !stats.isDirectory()) {
                      return sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                    }

                    try {
                      const items = fs.readdirSync(target, { withFileTypes: true });
                      const entries = items.map((item) => {
                        const fullItemPath = path.join(target, item.name);
                        let size = 0;
                        let mtime = Math.floor(Date.now() / 1000);
                        try {
                          const s = fs.statSync(fullItemPath);
                          size = s.size;
                          mtime = Math.floor(s.mtimeMs / 1000);
                        } catch {}

                        const isDir = item.isDirectory();
                        const permStr = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                        const dateStr = new Date(mtime * 1000).toDateString().slice(4, 10);
                        const longname = `${permStr} 1 ${siteUser} ${siteUser} ${String(size).padStart(8, ' ')} ${dateStr} ${item.name}`;

                        return {
                          filename: item.name,
                          longname,
                          attrs: {
                            mode: isDir ? 0o40755 : 0o100644,
                            uid: 1000,
                            gid: 1000,
                            size,
                            mtime,
                            atime: mtime,
                          },
                        };
                      });

                      const handle = Buffer.alloc(4);
                      handle.writeUInt32BE(++handleCount, 0);
                      handles.set(handleCount, { type: 'dir', path: target, entries, returned: false });
                      sftpStream.handle(reqid, handle);
                    } catch {
                      return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    }
                  });
                });

                // READDIR
                sftpStream.on('READDIR', (reqid: any, handle: any) => {
                  const id = handle.readUInt32BE(0);
                  const state = handles.get(id);
                  if (!state || state.type !== 'dir') {
                    return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                  }

                  // Synchronously check if entries have already been delivered on this handle
                  // If so, immediately return EOF to conclude directory reading
                  if (state.returned) {
                    return sftpStream.status(reqid, STATUS_CODE.EOF);
                  }

                  state.returned = true;
                  sftpStream.name(reqid, (state.entries || []) as any);
                });

                // OPEN (file)
                sftpStream.on('OPEN', (reqid: any, filename: any, flags: any, attrs: any) => {
                  const target = resolveSafePath(filename);
                  let stringFlags = 'r';
                  try {
                    stringFlags = flagsToString(flags) || 'r';
                  } catch {
                    stringFlags = 'r';
                  }

                  fs.open(target, stringFlags, (err, fd) => {
                    if (err) {
                      if (err.code === 'ENOENT') return sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                      if (err.code === 'EACCES') return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
                      return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    }
                    const handle = Buffer.alloc(4);
                    handle.writeUInt32BE(++handleCount, 0);
                    handles.set(handleCount, { type: 'file', path: target, fd });
                    sftpStream.handle(reqid, handle);
                  });
                });

                // READ
                sftpStream.on('READ', (reqid: any, handle: any, offset: any, length: any) => {
                  const id = handle.readUInt32BE(0);
                  const state = handles.get(id);
                  if (!state || state.type !== 'file' || typeof state.fd !== 'number') {
                    return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                  }

                  const buf = Buffer.alloc(length);
                  fs.read(state.fd, buf, 0, length, offset, (err, bytesRead) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    if (bytesRead === 0) return sftpStream.status(reqid, STATUS_CODE.EOF);
                    sftpStream.data(reqid, buf.subarray(0, bytesRead));
                  });
                });

                // WRITE
                sftpStream.on('WRITE', (reqid: any, handle: any, offset: any, data: any) => {
                  const id = handle.readUInt32BE(0);
                  const state = handles.get(id);
                  if (!state || state.type !== 'file' || typeof state.fd !== 'number') {
                    return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                  }

                  fs.write(state.fd, data, 0, data.length, offset, (err) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    sftpStream.status(reqid, STATUS_CODE.OK);
                  });
                });

                // FSTAT
                sftpStream.on('FSTAT', (reqid: any, handle: any) => {
                  const id = handle.readUInt32BE(0);
                  const state = handles.get(id);
                  if (!state || typeof state.fd !== 'number') {
                    return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                  }
                  fs.fstat(state.fd, (err, stats) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    sftpStream.attrs(reqid, toAttributes(stats) as any);
                  });
                });

                // SETSTAT
                sftpStream.on('SETSTAT', (reqid: any, p: any, attrs: any) => {
                  const target = resolveSafePath(p);
                  // chmod or utimes if requested
                  if (typeof attrs.mode === 'number') {
                    try {
                      fs.chmodSync(target, attrs.mode);
                    } catch {}
                  }
                  sftpStream.status(reqid, STATUS_CODE.OK);
                });

                // FSETSTAT
                sftpStream.on('FSETSTAT', (reqid: any, handle: any, attrs: any) => {
                  const id = handle.readUInt32BE(0);
                  const state = handles.get(id);
                  if (state && typeof state.fd === 'number' && typeof attrs.mode === 'number') {
                    try {
                      fs.fchmodSync(state.fd, attrs.mode);
                    } catch {}
                  }
                  sftpStream.status(reqid, STATUS_CODE.OK);
                });

                // CLOSE
                sftpStream.on('CLOSE', (reqid: any, handle: any) => {
                  const id = handle.readUInt32BE(0);
                  const state = handles.get(id);
                  if (state && typeof state.fd === 'number') {
                    try {
                      fs.closeSync(state.fd);
                    } catch {}
                  }
                  handles.delete(id);
                  sftpStream.status(reqid, STATUS_CODE.OK);
                });

                // MKDIR
                sftpStream.on('MKDIR', (reqid: any, p: any, attrs: any) => {
                  const target = resolveSafePath(p);
                  fs.mkdir(target, { recursive: true }, (err) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    sftpStream.status(reqid, STATUS_CODE.OK);
                  });
                });

                // RMDIR
                sftpStream.on('RMDIR', (reqid: any, p: any) => {
                  const target = resolveSafePath(p);
                  fs.rm(target, { recursive: true, force: true }, (err) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    sftpStream.status(reqid, STATUS_CODE.OK);
                  });
                });

                // UNLINK
                sftpStream.on('UNLINK', (reqid: any, p: any) => {
                  const target = resolveSafePath(p);
                  fs.unlink(target, (err) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    sftpStream.status(reqid, STATUS_CODE.OK);
                  });
                });

                // RENAME
                sftpStream.on('RENAME', (reqid: any, oldPath: any, newPath: any) => {
                  const oldTarget = resolveSafePath(oldPath);
                  const newTarget = resolveSafePath(newPath);
                  fs.rename(oldTarget, newTarget, (err) => {
                    if (err) return sftpStream.status(reqid, STATUS_CODE.FAILURE);
                    sftpStream.status(reqid, STATUS_CODE.OK);
                  });
                });
              });
            });
          });
        }
      );

      server.on('error', (err: any) => {
        console.error(`[SFTP Service] Server error on port ${tryPort}:`, err.message);
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          // If port 22 failed and we haven't tried fallback 2222 yet
          if (tryPort === 22) {
            console.log('[SFTP Service] Port 22 unavailable, falling back to port 2222...');
            this.port = 2222;
            server.close(() => {
              this.start(2222).then(resolve).catch(reject);
            });
            return;
          }
        }
        this.running = false;
        this.server = null;
        resolve({ success: false, port: tryPort, message: err.message });
      });

      server.listen(tryPort, '0.0.0.0', () => {
        this.running = true;
        this.server = server;
        this.port = tryPort;
        console.log(`[SFTP Service] Server listening on port ${this.port}`);
        resolve({ success: true, port: this.port, message: `SFTP service started on port ${this.port}` });
      });
    });
  }

  public async stop(): Promise<{ success: boolean; message: string }> {
    this.enabled = false;
    await this.saveState();

    if (!this.server) {
      this.running = false;
      return { success: true, message: 'SFTP service is not running.' };
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.running = false;
        console.log('[SFTP Service] Server stopped.');
        resolve({ success: true, message: 'SFTP service stopped.' });
      });
    });
  }

  public async restart(desiredPort?: number): Promise<{ success: boolean; port: number; message: string }> {
    await this.stop();
    await new Promise((r) => setTimeout(r, 600));
    return this.start(desiredPort || this.port);
  }
}

export const sftpService = new SftpService();
