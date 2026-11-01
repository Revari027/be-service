/**
 * Central application configuration.
 *
 * All environment access happens here so the rest of the codebase never reads
 * process.env directly. Values are validated once at startup and the process
 * fails fast when something required is missing (SDD section 8).
 */
const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEFAULT_DEV_JWT_SECRET = 'dev-only-jwt-secret-do-not-use-in-production';
const JWT_ISSUER = 'inventory-backend';
const AUTH_COOKIE_NAME = 'inventory_token';
const CSRF_COOKIE_NAME = 'csrf_token';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(8080),

  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().max(65535).default(3306),
  DB_NAME: z.string().min(1).default('inventory_db'),
  DB_USER: z.string().min(1).default('inventory_user'),
  DB_PASSWORD: z.string().default(''),
  DATABASE_URL: z.string().min(1).optional(),
  DB_POOL_LIMIT: z.coerce.number().int().min(1).max(100).default(10),

  JWT_SECRET: z.string().min(16).default(DEFAULT_DEV_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().min(1).default('8h'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

function parseDurationToMs(expression) {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(String(expression).trim());
  if (!match) return 8 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

  return amount * multipliers[unit];
}

function buildDatabaseUrl(values) {
  const user = encodeURIComponent(values.DB_USER);
  const password = values.DB_PASSWORD ? `:${encodeURIComponent(values.DB_PASSWORD)}` : '';
  const query = `connection_limit=${values.DB_POOL_LIMIT}`;

  return `mysql://${user}${password}@${values.DB_HOST}:${values.DB_PORT}/${values.DB_NAME}?${query}`;
}

function resolveDatabaseUrl(values) {
  if (!values.DATABASE_URL) return buildDatabaseUrl(values);

  // DATABASE_URL takes precedence. DB_POOL_LIMIT is only appended when the URL
  // does not already carry an explicit connection_limit.
  if (values.DATABASE_URL.includes('connection_limit=')) return values.DATABASE_URL;

  const separator = values.DATABASE_URL.includes('?') ? '&' : '?';

  return `${values.DATABASE_URL}${separator}connection_limit=${values.DB_POOL_LIMIT}`;
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');

  // Never log values here, only the offending keys.
  throw new Error(`Invalid environment configuration -> ${details}`);
}

const values = parsed.data;
const isProduction = values.NODE_ENV === 'production';

if (isProduction) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be provided explicitly in production');
  }

  if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
    throw new Error('DATABASE_URL or DB_PASSWORD must be provided in production');
  }
}

const databaseUrl = resolveDatabaseUrl(values);

// PrismaClient reads DATABASE_URL from the environment (see src/config/database.js).
// Fall back to the decomposed DB_* variables when the URL was not supplied.
process.env.DATABASE_URL = databaseUrl;

const sessionMaxAgeMs = parseDurationToMs(values.JWT_EXPIRES_IN);
const sameSite = isProduction ? 'none' : 'lax';
const cookiePath = '/';

module.exports = {
  nodeEnv: values.NODE_ENV,
  isProduction,
  isTest: values.NODE_ENV === 'test',
  port: values.PORT,
  db: {
    host: values.DB_HOST,
    port: values.DB_PORT,
    name: values.DB_NAME,
    user: values.DB_USER,
    password: values.DB_PASSWORD,
    poolLimit: values.DB_POOL_LIMIT,
    url: databaseUrl,
  },
  jwt: {
    secret: values.JWT_SECRET,
    expiresIn: values.JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
  },
  corsOrigins: values.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookie: {
    name: AUTH_COOKIE_NAME,
    csrfCookieName: CSRF_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: cookiePath,
      maxAge: sessionMaxAgeMs,
    },
    clearOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: cookiePath,
    },
    csrfOptions: {
      httpOnly: false,
      secure: isProduction,
      sameSite,
      path: cookiePath,
      maxAge: sessionMaxAgeMs,
    },
    csrfClearOptions: {
      httpOnly: false,
      secure: isProduction,
      sameSite,
      path: cookiePath,
    },
  },
};
