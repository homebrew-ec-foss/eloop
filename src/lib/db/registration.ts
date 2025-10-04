import { turso } from './client';
import { Registration } from '@/types';

// Helper to convert database row to Registration object
export function rowToRegistration(row: Record<string, unknown>): Registration {
  const checkpointCheckIns = row.checkpoint_checkins 
    ? JSON.parse(row.checkpoint_checkins as string) 
    : [];
  
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    userId: row.user_id as string,
    responses: JSON.parse(row.responses as string) as Record<string, unknown>,
    status: row.status as 'pending' | 'approved' | 'rejected' | 'checked-in',
    qrCode: row.qr_code as string,
    checkpointCheckIns: checkpointCheckIns,
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at as number) : undefined,
    rejectedBy: row.rejected_by as string | undefined,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at as number) : undefined,
    createdAt: new Date(row.created_at as number),
    updatedAt: new Date(row.updated_at as number)
  };
}

// Create a new registration
export async function createRegistration(
  registration: Omit<Registration, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<Registration> {
  const now = Date.now();
  const id = crypto.randomUUID();
  
  await turso.execute({
    sql: `
      INSERT INTO registrations (id, event_id, user_id, responses, status, qr_code, checkpoint_checkins, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      registration.eventId,
      registration.userId,
      JSON.stringify(registration.responses),
      'pending', // Initial status is pending until approved
      registration.qrCode,
      JSON.stringify([]), // Initialize with empty checkpoint check-ins array
      now,
      now
    ]
  });

  return {
    ...registration,
    id,
    status: 'pending', // Initial status is pending
    checkpointCheckIns: [],
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };
}

// Get a registration by id
export async function getRegistrationById(id: string): Promise<Registration | null> {
  const result = await turso.execute({
    sql: `SELECT * FROM registrations WHERE id = ?`,
    args: [id]
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToRegistration(result.rows[0]);
}

// Get a registration by QR code
export async function getRegistrationByQRCode(qrCode: string): Promise<Registration | null> {
  const result = await turso.execute({
    sql: `SELECT * FROM registrations WHERE qr_code = ?`,
    args: [qrCode]
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToRegistration(result.rows[0]);
}

// Get all registrations for an event
export async function getEventRegistrations(eventId: string): Promise<Registration[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM registrations WHERE event_id = ?`,
    args: [eventId]
  });

  return result.rows.map(rowToRegistration);
}

// Get a user's registrations
export async function getUserRegistrations(userId: string): Promise<Registration[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM registrations WHERE user_id = ?`,
    args: [userId]
  });

  return result.rows.map(rowToRegistration);
}

// Check if a user has registered for a specific event
export async function getUserEventRegistration(userId: string, eventId: string): Promise<Registration | null> {
  const result = await turso.execute({
    sql: `SELECT * FROM registrations WHERE user_id = ? AND event_id = ?`,
    args: [userId, eventId]
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToRegistration(result.rows[0]);
}

// Check in a participant at a specific checkpoint
export async function checkInParticipantAtCheckpoint(
  qrCode: string, 
  checkpoint: string,
  volunteerId: string
): Promise<Registration | null> {
  const now = Date.now();
  
  // Get the current registration
  const registration = await getRegistrationByQRCode(qrCode);
  
  // Registration must exist and be either approved or already checked-in
  if (!registration || (registration.status !== 'approved' && registration.status !== 'checked-in')) {
    return null;
  }
  
  // Add new checkpoint check-in
  const checkpointCheckIns = registration.checkpointCheckIns || [];
  
  // Check if already checked in at this checkpoint
  const alreadyCheckedIn = checkpointCheckIns.some(c => c.checkpoint === checkpoint);
  if (alreadyCheckedIn) {
    return registration; // Already checked in at this checkpoint
  }
  
  checkpointCheckIns.push({
    checkpoint,
    checkedInBy: volunteerId,
    checkedInAt: new Date(now)
  });
  
  // Update status to 'checked-in' on first checkpoint check-in
  const newStatus = checkpointCheckIns.length > 0 ? 'checked-in' : registration.status;
  
  await turso.execute({
    sql: `
      UPDATE registrations 
      SET 
        checkpoint_checkins = ?,
        status = ?,
        updated_at = ?
      WHERE qr_code = ?
    `,
    args: [
      JSON.stringify(checkpointCheckIns),
      newStatus,
      now,
      qrCode
    ]
  });
  
  return getRegistrationByQRCode(qrCode);
}

// Legacy function - check in at first checkpoint (Registration)
export async function checkInParticipant(qrCode: string, volunteerId: string): Promise<Registration | null> {
  return checkInParticipantAtCheckpoint(qrCode, 'Registration', volunteerId);
}

// Get event analytics
export async function getEventAnalytics(eventId: string): Promise<{ 
  registered: number;
  checkedIn: number;
  checkInRate: number;
}> {
  const registrations = await getEventRegistrations(eventId);
  
  const registered = registrations.length;
  const checkedIn = registrations.filter(r => r.status === 'checked-in').length;
  const checkInRate = registered > 0 ? (checkedIn / registered) : 0;
  
  return {
    registered,
    checkedIn,
    checkInRate
  };
}

// Get detailed event analytics with form field breakdown
export async function getDetailedEventAnalytics(eventId: string): Promise<{
  registered: number;
  checkedIn: number;
  checkInRate: number;
  fieldResponses: Record<string, Record<string, number>>;
}> {
  const registrations = await getEventRegistrations(eventId);
  
  const registered = registrations.length;
  const checkedIn = registrations.filter(r => r.status === 'checked-in').length;
  const checkInRate = registered > 0 ? (checkedIn / registered) : 0;
  
  // Analyze form responses
  const fieldResponses: Record<string, Record<string, number>> = {};
  
  registrations.forEach(registration => {
    Object.entries(registration.responses).forEach(([field, value]) => {
      if (!fieldResponses[field]) {
        fieldResponses[field] = {};
      }
      
      // Handle different types of values
      const stringValue = String(value);
      
      if (!fieldResponses[field][stringValue]) {
        fieldResponses[field][stringValue] = 0;
      }
      
      fieldResponses[field][stringValue]++;
    });
  });
  
  return {
    registered,
    checkedIn,
    checkInRate,
    fieldResponses
  };
}

// Approve a registration
export async function approveRegistration(
  registrationId: string, 
  approvedBy: string
): Promise<Registration | null> {
  const now = Date.now();
  
  await turso.execute({
    sql: `
      UPDATE registrations 
      SET status = ?, approved_by = ?, approved_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: ['approved', approvedBy, now, now, registrationId]
  });
  
  return getRegistrationById(registrationId);
}

// Reject a registration
export async function rejectRegistration(
  registrationId: string, 
  rejectedBy: string
): Promise<Registration | null> {
  const now = Date.now();
  
  await turso.execute({
    sql: `
      UPDATE registrations 
      SET status = ?, rejected_by = ?, rejected_at = ?, updated_at = ?
      WHERE id = ?
    `,
    args: ['rejected', rejectedBy, now, now, registrationId]
  });
  
  return getRegistrationById(registrationId);
}

// Get all pending registrations for an event
export async function getPendingRegistrations(eventId: string): Promise<Registration[]> {
  const result = await turso.execute({
    sql: `SELECT * FROM registrations WHERE event_id = ? AND status = 'pending' ORDER BY created_at DESC`,
    args: [eventId]
  });

  return result.rows.map(rowToRegistration);
}