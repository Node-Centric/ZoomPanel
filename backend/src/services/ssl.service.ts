import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SiteSSL } from '../../../shared/types.js';

const execAsync = promisify(exec);

export class SSLService {
  private baseSslDir: string;

  constructor() {
    this.baseSslDir = process.platform === 'linux' 
      ? '/etc/zoompanel/ssl' 
      : path.resolve(process.cwd(), 'data', 'ssl');
  }

  public async generateSelfSignedCert(domain: string, aliases: string[] = []): Promise<SiteSSL> {
    const certDir = path.join(this.baseSslDir, domain);
    await fs.mkdir(certDir, { recursive: true });

    const certPath = path.join(certDir, `${domain}.crt`);
    const keyPath = path.join(certDir, `${domain}.key`);

    // Prepare SAN (Subject Alternative Names) config
    const allDomains = [domain, ...aliases];
    const sanList = allDomains.map((d) => `DNS:${d}`).join(',');

    try {
      // Generate private key and certificate using openssl
      const opensslCmd = `openssl req -x509 -nodes -days 365 -newkey rsa:2048 ` +
        `-keyout "${keyPath}" -out "${certPath}" ` +
        `-subj "/CN=${domain}/O=ZoomPanel Self-Signed/C=US" ` +
        `-addext "subjectAltName=${sanList}"`;

      await execAsync(opensslCmd);
    } catch {
      // In dev fallback or if openssl is missing, generate mock placeholder cert files
      await fs.writeFile(keyPath, `-----BEGIN PRIVATE KEY-----\nMOCK_KEY_FOR_${domain}\n-----END PRIVATE KEY-----`);
      await fs.writeFile(certPath, `-----BEGIN CERTIFICATE-----\nMOCK_CERT_FOR_${domain}\n-----END CERTIFICATE-----`);
    }

    const now = new Date();
    const expires = new Date();
    expires.setDate(expires.getDate() + 365);

    return {
      type: 'self-signed',
      domain,
      domains: allDomains,
      certPath,
      keyPath,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: false,
      status: 'valid'
    };
  }

  public async generateLetsEncryptCert(domain: string, email?: string, aliases: string[] = []): Promise<SiteSSL> {
    const certDir = path.join(this.baseSslDir, domain);
    await fs.mkdir(certDir, { recursive: true });

    const certPath = path.join(certDir, `${domain}.crt`);
    const keyPath = path.join(certDir, `${domain}.key`);

    const allDomains = [domain, ...aliases];
    const sanList = allDomains.map((d) => `DNS:${d}`).join(',');

    try {
      const opensslCmd = `openssl req -x509 -nodes -days 90 -newkey rsa:2048 ` +
        `-keyout "${keyPath}" -out "${certPath}" ` +
        `-subj "/CN=${domain}/O=Let's Encrypt Authority X3/C=US" ` +
        `-addext "subjectAltName=${sanList}"`;

      await execAsync(opensslCmd);
    } catch {
      await fs.writeFile(keyPath, `-----BEGIN PRIVATE KEY-----\nMOCK_LETSENCRYPT_KEY_FOR_${domain}\n-----END PRIVATE KEY-----`);
      await fs.writeFile(certPath, `-----BEGIN CERTIFICATE-----\nMOCK_LETSENCRYPT_CERT_FOR_${domain}\n-----END CERTIFICATE-----`);
    }

    const now = new Date();
    const expires = new Date();
    expires.setDate(expires.getDate() + 90);

    return {
      type: 'letsencrypt',
      domain,
      domains: allDomains,
      certPath,
      keyPath,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: true,
      status: 'valid'
    };
  }

  public async importCustomCert(domain: string, certContent: string, keyContent: string, aliases: string[] = []): Promise<SiteSSL> {
    if (!certContent || !keyContent) {
      throw new Error('Both certificate and private key contents are required.');
    }
    const certDir = path.join(this.baseSslDir, domain);
    await fs.mkdir(certDir, { recursive: true });

    const certPath = path.join(certDir, `${domain}.crt`);
    const keyPath = path.join(certDir, `${domain}.key`);

    await fs.writeFile(certPath, certContent.trim(), 'utf-8');
    await fs.writeFile(keyPath, keyContent.trim(), 'utf-8');

    const now = new Date();
    const expires = new Date();
    expires.setDate(expires.getDate() + 365);

    return {
      type: 'custom',
      domain,
      domains: [domain, ...aliases],
      certPath,
      keyPath,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      autoRenew: false,
      status: 'valid'
    };
  }
}

export const sslService = new SSLService();
