import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { db, initDb } from './db/index.js';
import { errorHandler } from './lib/http.js';
import studentsRouter from './routes/students.js';
import productsRouter from './routes/products.js';
import posRouter from './routes/pos.js';
import feesRouter from './routes/fees.js';
import reportsRouter from './routes/reports.js';
import drawerRouter from './routes/drawer.js';
import settingsRouter from './routes/settings.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  const setting = await db.get("SELECT value FROM settings WHERE key = 'school_name'");
  res.json({
    ok: true,
    db: db.kind,
    school_name: setting?.value || config.schoolName,
    version: '0.2.0',
    time: new Date().toISOString(),
  });
});

app.use('/api/students', studentsRouter);
app.use('/api/products', productsRouter);
app.use('/api/pos', posRouter);
app.use('/api/fees', feesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/drawer', drawerRouter);
app.use('/api/settings', settingsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' }));

const distCandidates = [
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
];
const dist = distCandidates.find((p) => fs.existsSync(path.join(p, 'index.html')));
if (dist) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

initDb()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[sms-pos] API listening on http://localhost:${config.port} · db=${db.kind}`);
      if (dist) console.log(`[sms-pos] serving client build from ${dist}`);
    });
  })
  .catch((error) => {
    console.error('[sms-pos] failed to start', error);
    process.exit(1);
  });
