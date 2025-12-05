import { createClient } from '@libsql/client';
import { config as loadDotenv } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Ensure common .env files are read when running in environments where
// We try in order but do not override any already-present env vars.
const envFiles = ['.env', '.env.local', '.env.development', '.env.development.local'];
for (const f of envFiles) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    try {
      loadDotenv({ path: p, override: false });
    } catch (e) {
    }
  }
}

// Read and validate Turso environment variables early and fail fast
const TURSO_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const TURSO_AUTH = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL) {
  throw new Error(
    'TURSO_DATABASE_URL (or DATABASE_URL) environment variable is not set.\n' +
      'Provide this via your environment, a .env.local file, .env.development.local, or Vercel project settings.'
  );
}

if (!TURSO_AUTH) {
  console.warn('Warning: TURSO_AUTH_TOKEN is not set. Authenticated operations may fail.');
}

// Initialize Turso client
export const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH || undefined,
});

// NOTE: Do NOT run initialization on import. Initialization is handled
// explicitly by `scripts/check-and-init-db.js` during build or by calling
// `initDatabase()` from a controlled bootstrap path. Avoiding network calls
// during module import prevents unexpected behavior during builds.

// Create or get Turso tables
export async function initDatabase() {
  try {
    // User profiles table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        organizer_id TEXT,
        is_approved INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Events table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        date INTEGER NOT NULL,
        location TEXT,
        organizer_id TEXT NOT NULL,
        form_schema TEXT NOT NULL, -- JSON string of form schema
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(organizer_id) REFERENCES users(id)
      )
    `);

    // Registrations table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS registrations (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        responses TEXT NOT NULL, -- JSON string of form responses
        status TEXT NOT NULL,
        qr_code TEXT NOT NULL UNIQUE,
        checkpoint_checkins TEXT DEFAULT '[]', -- JSON array of checkpoint check-ins with status
        approved_by TEXT,
        approved_at INTEGER,
        rejected_by TEXT,
        rejected_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(event_id) REFERENCES events(id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(approved_by) REFERENCES users(id),
        FOREIGN KEY(rejected_by) REFERENCES users(id)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}