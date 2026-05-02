import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth.js';
import shipmentsRoutes from './routes/shipments.js';
import customersRoutes from './routes/customers.js';
import usersRoutes from './routes/users.js';
import notifRoutes from './routes/notifications.js';
import portalRoutes from './routes/portal.js';

import { errorHandler } from './middleware/errorHandler.js';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Swift Imports API',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/portal', portalRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀  Swift Imports API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

process.on('SIGINT', () => prisma.$disconnect().then(() => process.exit(0)));
process.on('SIGTERM', () => prisma.$disconnect().then(() => process.exit(0)));