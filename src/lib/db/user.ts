import { turso } from './client';
import { UserProfile, UserRole } from '@/types';

// Helper to convert database row to UserProfile object
function rowToUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as UserRole,
    organizerId: row.organizer_id as string | undefined,
    createdAt: new Date(row.created_at as number),
    updatedAt: new Date(row.updated_at as number)
  };
}

// Create a new user
export async function createUser(user: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
  console.log(`createUser function called with: ${JSON.stringify(user)}`);
  const now = Date.now();
  
  try {
    const result = await turso.execute({
      sql: `
        INSERT INTO users (id, email, name, role, organizer_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        user.id,
        user.email,
        user.name,
        user.role,
        user.organizerId || null,
        now,
        now
      ]
    });
    
    console.log(`User inserted into database. Result: ${JSON.stringify(result)}`);
    
    // Verify the user was created by fetching it back
    const verifyUser = await getUserById(user.id);
    console.log(`User verification: ${verifyUser ? 'Success' : 'Failed'}`);
    
    return {
      ...user,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };
  } catch (error) {
    console.error(`Error in createUser: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Get a user by id
export async function getUserById(id: string): Promise<UserProfile | null> {
  const result = await turso.execute({
    sql: `SELECT * FROM users WHERE id = ?`,
    args: [id]
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToUserProfile(result.rows[0]);
}

// Get a user by email
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  const result = await turso.execute({
    sql: `SELECT * FROM users WHERE email = ?`,
    args: [email]
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToUserProfile(result.rows[0]);
}

// Promote applicant to participant (approval)
export async function approveApplicant(userId: string): Promise<UserProfile | null> {
  const now = Date.now();
  await turso.execute({
    sql: `
      UPDATE users 
      SET role = 'participant', updated_at = ?
      WHERE id = ? AND role = 'applicant'
    `,
    args: [now, userId]
  });

  return getUserById(userId);
}

// Assign volunteer to organizer
export async function assignVolunteerToOrganizer(volunteerId: string, organizerId: string): Promise<UserProfile | null> {
  const now = Date.now();
  await turso.execute({
    sql: `
      UPDATE users 
      SET organizer_id = ?, updated_at = ?
      WHERE id = ? AND role = 'volunteer'
    `,
    args: [organizerId, now, volunteerId]
  });

  return getUserById(volunteerId);
}

// Get all volunteers for an organizer
export async function getOrganizerVolunteers(organizerId: string): Promise<UserProfile[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM users WHERE organizer_id = ? AND role = 'volunteer'`,
    args: [organizerId]
  });

  return result.rows.map(rowToUserProfile);
}

// Check if user has admin privileges
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role === 'admin';
}

// Check if user has organizer privileges (includes admin)
export async function hasOrganizerPrivileges(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role === 'admin' || user?.role === 'organizer';
}

// Check if user has volunteer privileges (includes admin and organizer)
export async function hasVolunteerPrivileges(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role === 'admin' || user?.role === 'organizer' || user?.role === 'volunteer';
}

// Get all users (admin only)
export async function getAllUsers(): Promise<UserProfile[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM users ORDER BY role, name`
  });

  return result.rows.map(rowToUserProfile);
}

// Get users by role
export async function getUsersByRole(role: UserRole): Promise<UserProfile[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM users WHERE role = ? ORDER BY name`,
    args: [role]
  });

  return result.rows.map(rowToUserProfile);
}

// Get all applicants (unapproved users)
export async function getApplicants(): Promise<UserProfile[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM users WHERE role = 'applicant' ORDER BY created_at DESC`
  });

  return result.rows.map(rowToUserProfile);
}

// Update a user's role
export async function updateUserRole(userId: string, newRole: UserRole): Promise<UserProfile | null> {
  const now = Date.now();
  await turso.execute({
    sql: `
      UPDATE users 
      SET role = ?, updated_at = ?
      WHERE id = ?
    `,
    args: [newRole, now, userId]
  });

  return getUserById(userId);
}

// Count the total number of users in the system
export async function countUsers(): Promise<number> {
  const result = await turso.execute({
    sql: `SELECT COUNT(*) as count FROM users`
  });

  return Number(result.rows[0]?.count || 0);
}