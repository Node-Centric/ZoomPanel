import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './routes/api.routes.js';
import { sitesService, DAEMON_PORT, FIRST_APP_PORT } from './services/sites.service.js';
import { nginxService } from './services/nginx.service.js';
import { mariaDbService } from './services/mariadb.service.js';
import { authService } from './services/auth.service.js';
import { sftpService } from './services/sftp.service.js';

const app = express();
const PORT = process.env.PORT || DAEMON_PORT; // 2999

app.use(cors());
app.use(express.json());

// Register API
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    name: 'ZoomPanel Core Daemon', 
    version: '1.0.0',
    daemonPort: PORT,
    firstAppPort: FIRST_APP_PORT
  });
});

// Serve frontend static assets if built
const candidateDistPaths = [
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), '../../frontend/dist')
];
const frontendDistPath = candidateDistPaths.find((p) => fs.existsSync(p));
if (frontendDistPath) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

async function bootstrap() {
  try {
    await authService.init();
    await mariaDbService.init();
    await sitesService.init();
    await nginxService.init();

    if (sftpService.isEnabled()) {
      await sftpService.start().catch((err) => {
        console.error('[SFTP Service] Boot warning:', err.message);
      });
    }

    // If no sites exist yet, seed a demonstration site on port 3000
    const existing = sitesService.getAllSites();
    if (existing.length === 0) {
      await sitesService.createSite({
        domain: 'demo-api.local',
        type: 'nodejs',
        port: FIRST_APP_PORT, // 3000
        nodeVersion: 'v26.12.1',
        entryFile: 'server.js',
        siteUser: 'demoapi',
        sitePassword: 'Password123!',
        enableSSL: true,
        sslType: 'self-signed',
        enableDatabases: true
      });
      console.log(`[ZoomPanel] Initialized with demo site demo-api.local on port ${FIRST_APP_PORT}`);
    }

    app.listen(PORT, () => {
      console.log(`[ZoomPanel Backend Daemon] Listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[ZoomPanel Backend] Failed to start:', err);
    process.exit(1);
  }
}

bootstrap();
