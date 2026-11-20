/* apps/api/src/env.ts */

// reads and checks configuration once at startup, so a missing secret stops the
// server immediately instead of surfacing later as a failed login

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');

export const env = {
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,

  // comma-separated list of origins allowed to call the API from a browser context
  // the Electron dev server is http://localhost:3000; a packaged app loads from file://, which sends Origin "null"
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,null')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
};
