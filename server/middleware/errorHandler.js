import { env } from '../config/env.js';

/**
 * Central Express error handler. Avoids leaking stack traces in production.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  const message =
    err.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be 2 MB or smaller'
      : err.message || 'Internal server error';
  if (env.NODE_ENV !== 'production') {
    console.error(err);
  }
  res.status(status).json({
    error: message,
    ...(env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
}
