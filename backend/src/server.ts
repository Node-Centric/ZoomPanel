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
import { firewallService } from './services/firewall.service.js';

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
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: `API endpoint ${req.path} not found` });
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

async function bootstrap() {
  try {
    await authService.init();
    await mariaDbService.init();
    await sitesService.init();
    await nginxService.init();
    await firewallService.init();

    if (sftpService.isEnabled()) {
      await sftpService.start().catch((err) => {
        console.error('[SFTP Service] Boot warning:', err.message);
      });
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
