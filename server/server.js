/**
 * Task Manager SaaS API — Express + Socket.io + PostgreSQL
 * REST under /api/*; Socket.io authenticated via handshake auth.token (JWT).
 */
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerBoardSockets } from './sockets/boardSocket.js';
import { uploadsRoot } from './middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use('/api/uploads', express.static(uploadsRoot));
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use('/api', routes);

app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'] },
});

app.set('io', io);
registerBoardSockets(io);

server.listen(env.PORT, () => {
  console.log(`API + WebSocket listening on port ${env.PORT}`);
});
