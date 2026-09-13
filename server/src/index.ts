import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './data-source';
import authRoutes from './routes/auth.routes';
import familyRoutes from './routes/family.routes';
import taskRoutes from './routes/task.routes';
import rewardRoutes from './routes/reward.routes';
import walletRoutes from './routes/wallet.routes';
import paymentRoutes from './routes/payment.routes';
import userRoutes from './routes/user.routes';
import { authLimiter } from './middleware/rateLimit';

dotenv.config();

const app = express();
app.disable('x-powered-by'); // don't advertise the framework/version

// Render/Railway terminate TLS at one proxy hop. Trust exactly that hop so the
// rate limiters key on the real client IP, not the load-balancer's, and so
// req.ip / req.protocol are accurate. `1` (not `true`) — a client must not be
// able to spoof X-Forwarded-For past the platform proxy.
app.set('trust proxy', 1);

// Cloud hosts (Render/Railway) inject PORT. SERVER_PORT stays as the local-dev override.
const PORT = parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '5000', 10);

// Comma-separated allowlist. Always keep localhost for local dev; add the
// deployed frontend origin(s) via CORS_ORIGINS in the cloud env.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin, curl, or a platform health check — allow.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false); // unknown origin: omit CORS headers, the browser blocks it
    },
  }),
);
// Paddle billing webhook needs the untouched raw request body to verify its
// HMAC signature, so it's mounted here — before the app-wide JSON parser
// below would consume and reserialize the stream. The route supplies its own
// express.raw() body parser; nothing else in this router needs express.json().
app.use('/api/payments', paymentRoutes);

app.use(express.json({ limit: '1mb' })); // JSON bodies are small; photo uploads go through multer, not here

// Liveness probe for Render/Railway. Returns 200 as soon as the process is up;
// `db` reflects whether TypeORM has finished connecting.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: AppDataSource.isInitialized });
});

// Proof and reference photos live in object storage (Cloudflare R2) and are
// served straight from its public bucket domain — nothing is served from disk here.

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/users', userRoutes);

// Unknown route → JSON 404 (not Express's default HTML page).
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Last-resort error handler: catches sync throws and next(err) from the routes
// so the client always gets clean JSON instead of a stack-trace HTML page.
// (Note: Express 4 still does not funnel *unhandled promise rejections* here —
// the async route handlers keep their own try/catch for that.)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: 'שגיאה בשרת. נסו שוב בעוד רגע.' });
});

async function bootstrap(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`ChoreChamps server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
