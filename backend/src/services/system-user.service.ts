import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SystemUserService {
  private isLinux = process.platform === 'linux';

  public getUserHomeDir(username: string): string {
    return this.isLinux
      ? `/home/${username}`
      : path.resolve(process.cwd(), 'data', 'home', username);
  }

  public getSiteWwwDir(username: string, domain: string): string {
    return this.isLinux
      ? `/home/${username}/www/${domain}`
      : path.resolve(process.cwd(), 'data', 'home', username, 'www', domain);
  }

  public async createSystemUser(username: string, password?: string): Promise<void> {
    const homeDir = this.getUserHomeDir(username);
    const sshDir = path.join(homeDir, '.ssh');
    const authKeysPath = path.join(sshDir, 'authorized_keys');

    if (this.isLinux) {
      try {
        // Check if user already exists
        await execAsync(`id -u "${username}"`);
      } catch {
        // User does not exist, create it
        await execAsync(`useradd -m -d "${homeDir}" -s /bin/bash "${username}"`);
      }

      // Add www-data to the user group so NGINX can access web assets
      try {
        await execAsync(`usermod -a -G "${username}" www-data`);
      } catch {}

      // Ensure directory permissions (750 allows group www-data to traverse)
      try {
        await execAsync(`chmod 750 "${homeDir}"`);
      } catch {}

      // Setup .ssh directory and authorized_keys
      try {
        await fs.mkdir(sshDir, { recursive: true });
        try {
          await fs.access(authKeysPath);
        } catch {
          await fs.writeFile(authKeysPath, '', { mode: 0o600 });
        }
        await execAsync(`chmod 700 "${sshDir}"`);
        await execAsync(`chmod 600 "${authKeysPath}"`);
        await execAsync(`chown -R "${username}:${username}" "${sshDir}"`);
      } catch {}
    } else {
      // Local development fallback
      await fs.mkdir(homeDir, { recursive: true });
      await fs.mkdir(sshDir, { recursive: true });
      try {
        await fs.access(authKeysPath);
      } catch {
        await fs.writeFile(authKeysPath, '', 'utf-8');
      }
    }

    // Set and synchronize password after user is created
    if (password) {
      await this.setPassword(username, password);
    }
  }

  private getCredsPath(): string {
    return path.resolve(process.cwd(), 'data', 'site-credentials.json');
  }

  private async loadCreds(): Promise<Record<string, { salt: string; hash: string }>> {
    try {
      const data = await fs.readFile(this.getCredsPath(), 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async saveCreds(creds: Record<string, { salt: string; hash: string }>): Promise<void> {
    const credsPath = this.getCredsPath();
    await fs.mkdir(path.dirname(credsPath), { recursive: true });
    await fs.writeFile(credsPath, JSON.stringify(creds, null, 2), 'utf-8');
  }

  public async setPassword(username: string, password: string): Promise<void> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const creds = await this.loadCreds();
    creds[username] = { salt, hash };
    await this.saveCreds(creds);

    if (this.isLinux) {
      try {
        // Feed username:password safely through stdin to avoid shell escaping issues
        await new Promise<void>((resolve, reject) => {
          const child = spawn('chpasswd', [], { stdio: ['pipe', 'ignore', 'pipe'] });
          child.stdin.write(`${username}:${password}\n`);
          child.stdin.end();
          child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`chpasswd exited with code ${code}`));
          });
          child.on('error', reject);
        });
        // Unlock user account in shadow in case useradd locked it
        await execAsync(`usermod -U "${username}"`).catch(() => {});
      } catch (err: any) {
        console.error(`[SystemUserService] Failed to set Linux password for ${username}:`, err.message);
      }
    }
  }

  public async hasPassword(username: string): Promise<boolean> {
    const creds = await this.loadCreds();
    return Boolean(creds[username]);
  }

  public async verifyPassword(username: string, password: string): Promise<boolean> {
    const creds = await this.loadCreds();
    const entry = creds[username];
    if (!entry) return false;
    const testHash = crypto.scryptSync(password, entry.salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(entry.hash, 'hex'));
  }

  public async getSshKeys(username: string): Promise<string[]> {
    const authKeysPath = path.join(this.getUserHomeDir(username), '.ssh', 'authorized_keys');
    try {
      const content = await fs.readFile(authKeysPath, 'utf-8');
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    } catch {
      return [];
    }
  }

  public async addSshKey(username: string, publicKey: string): Promise<string[]> {
    const cleanKey = publicKey.trim();
    if (!cleanKey) throw new Error('Public key cannot be empty');

    const homeDir = this.getUserHomeDir(username);
    const sshDir = path.join(homeDir, '.ssh');
    const authKeysPath = path.join(sshDir, 'authorized_keys');

    await fs.mkdir(sshDir, { recursive: true });
    let existingKeys = await this.getSshKeys(username);

    if (existingKeys.includes(cleanKey)) {
      return existingKeys;
    }

    existingKeys.push(cleanKey);
    await fs.writeFile(authKeysPath, existingKeys.join('\n') + '\n', { mode: 0o600 });

    if (this.isLinux) {
      try {
        await execAsync(`chmod 700 "${sshDir}"`);
        await execAsync(`chmod 600 "${authKeysPath}"`);
        await execAsync(`chown -R "${username}:${username}" "${sshDir}"`);
      } catch {}
    }

    return existingKeys;
  }

  public async removeSshKey(username: string, publicKey: string): Promise<string[]> {
    const cleanKey = publicKey.trim();
    const homeDir = this.getUserHomeDir(username);
    const authKeysPath = path.join(homeDir, '.ssh', 'authorized_keys');

    let existingKeys = await this.getSshKeys(username);
    existingKeys = existingKeys.filter((k) => k !== cleanKey);

    await fs.writeFile(authKeysPath, existingKeys.join('\n') + (existingKeys.length > 0 ? '\n' : ''), { mode: 0o600 });

    if (this.isLinux) {
      try {
        await execAsync(`chown -R "${username}:${username}" "${path.join(homeDir, '.ssh')}"`);
      } catch {}
    }

    return existingKeys;
  }
}

export const systemUserService = new SystemUserService();
