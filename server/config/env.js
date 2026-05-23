import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback = null) {
  const v = process.env[name] ?? fallback;
  if (v === null || v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL: required('DATABASE_URL', 'postgresql://localhost:5432/taskmanager'),
  JWT_SECRET: required('JWT_SECRET', 'dev-only-change-in-production'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};
