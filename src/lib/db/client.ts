import { createClient } from '@libsql/client';

// Initialize Turso client
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// Run database initialization on import
(async () => {
  try {
    // Check if tables exist
    const checkEventsTable = await turso.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='events'
    `);
    
    if (checkEventsTable.rows.length === 0) {
      console.log('Database tables not found. Auto-initializing...');
      await initDatabase();
    }
  } catch (error) {
    console.error('Error checking database on startup:', error);
  }
})();

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