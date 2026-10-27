import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { SafeUser, PanelSettings, SetupPayload } from '../../../shared/types.js';

interface StoredUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  salt: string;
  isDefaultAdmin: boolean;
  createdAt: string;
}

export class AuthService {
  private baseDir = process.cwd().replace(/[/\\]backend$/, '');
  private usersFile = path.resolve(this.baseDir, 'backend/data/users.json');
  private settingsFile = path.resolve(this.baseDir, 'backend/data/settings.json');
  private users: StoredUser[] = [];
  private settings: PanelSettings = {
    initialized: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
  private sessions = new Map<string, { userId: string; expiresAt: number }>();

  public async init() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.usersFile);
    await fs.mkdir(dataDir, { recursive: true });

    // Load Settings
    try {
      const settingsRaw = await fs.readFile(this.settingsFile, 'utf-8');
      this.settings = JSON.parse(settingsRaw);
    } catch {
      this.settings = {
        initialized: false,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };
      await this.saveSettings();
    }

    // Load Users
    try {
      const usersRaw = await fs.readFile(this.usersFile, 'utf-8');
      this.users = JSON.parse(usersRaw);
    } catch {
      this.users = [];
      await this.saveUsers();
    }

    // If users exist, ensure initialized is true
    if (this.users.length > 0 && !this.settings.initialized) {
      this.settings.initialized = true;
      await this.saveSettings();
    }
  }

  private async saveUsers() {
    await fs.writeFile(this.usersFile, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  private async saveSettings() {
    await fs.writeFile(this.settingsFile, JSON.stringify(this.settings, null, 2), 'utf-8');
  }

  public isInitialized(): boolean {
    return this.settings.initialized && this.users.length > 0;
  }

  public getSettings(): PanelSettings {
    return { ...this.settings };
  }

  public async updateSettings(patch: Partial<PanelSettings>): Promise<PanelSettings> {
    if (patch.timeZone) {
      this.settings.timeZone = patch.timeZone;
    }
    await this.saveSettings();
    return { ...this.settings };
  }

  public async setup(payload: SetupPayload): Promise<{ user: SafeUser; settings: PanelSettings }> {
    if (this.isInitialized()) {
      throw new Error('ZoomPanel initial setup has already been completed.');
    }

    const { username, email, firstName, lastName, password, timeZone } = payload;

    if (!username || !username.trim()) throw new Error('Username is required.');
    if (!email || !email.trim()) throw new Error('Email is required.');
    if (!firstName || !firstName.trim()) throw new Error('First Name is required.');
    if (!lastName || !lastName.trim()) throw new Error('Last Name is required.');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (!timeZone || !timeZone.trim()) throw new Error('Time zone is required.');

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

    const newUser: StoredUser = {
      id: `usr_${Date.now()}`,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash,
      salt,
      isDefaultAdmin: true, // Cannot be deleted
      createdAt: new Date().toISOString(),
    };

    this.users = [newUser];
    await this.saveUsers();

    this.settings = {
      initialized: true,
      timeZone: timeZone.trim(),
      configuredAt: new Date().toISOString(),
    };
    await this.saveSettings();

    return {
      user: this.toSafeUser(newUser),
      settings: { ...this.settings },
    };
  }

  public async login(usernameOrEmail: string, password: string): Promise<{ token: string; user: SafeUser }> {
    if (!this.isInitialized()) {
      throw new Error('ZoomPanel setup has not been completed yet.');
    }

    const search = usernameOrEmail.trim().toLowerCase();
    const user = this.users.find(
      (u) => u.username.toLowerCase() === search || u.email.toLowerCase() === search
    );

    if (!user) {
      throw new Error('Invalid username or password.');
    }

    const testHash = crypto.scryptSync(password, user.salt, 64).toString('hex');
    if (testHash !== user.passwordHash) {
      throw new Error('Invalid username or password.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.sessions.set(token, { userId: user.id, expiresAt });

    return {
      token,
      user: this.toSafeUser(user),
    };
  }

  public validateToken(token?: string): SafeUser | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    const user = this.users.find((u) => u.id === session.userId);
    return user ? this.toSafeUser(user) : null;
  }

  public logout(token?: string): boolean {
    if (token) {
      this.sessions.delete(token);
    }
    return true;
  }

  public getTimezones(): { id: string; label: string; offset: string }[] {
    const list = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'America/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'America/Bogota',
      'America/Sao_Paulo',
      'America/Buenos_Aires',
      'Europe/London',
      'Europe/Dublin',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Amsterdam',
      'Europe/Stockholm',
      'Europe/Athens',
      'Europe/Warsaw',
      'Europe/Kyiv',
      'Europe/Moscow',
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'Africa/Nairobi',
      'Asia/Dubai',
      'Asia/Riyadh',
      'Asia/Jerusalem',
      'Asia/Tehran',
      'Asia/Kolkata',
      'Asia/Dhaka',
      'Asia/Bangkok',
      'Asia/Singapore',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Taipei',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',
      'Pacific/Fiji',
    ];

    const now = new Date();
    return list.map((tz) => {
      try {
        const str = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'shortOffset',
        }).format(now);
        const match = str.match(/GMT([+-]?\d+(:?\d+)?)/);
        const offset = match ? `GMT${match[1]}` : 'GMT';
        return {
          id: tz,
          label: `${tz.replace(/_/g, ' ')} (${offset})`,
          offset,
        };
      } catch {
        return {
          id: tz,
          label: tz.replace(/_/g, ' '),
          offset: '',
        };
      }
    });
  }

  private toSafeUser(user: StoredUser): SafeUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isDefaultAdmin: user.isDefaultAdmin,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
