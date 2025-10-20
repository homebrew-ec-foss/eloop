import QRCode from 'qrcode';
import { jwtVerify, SignJWT } from 'jose';
import { QRData } from '@/types';

// Secret key for QR code verification
const SECRET_KEY = new TextEncoder().encode(
  process.env.QR_SECRET || 'default-secret-change-in-production'
);

// Generate a QR code for participant check-in
export async function generateParticipantQR(userId: string, eventId: string): Promise<string> {
  const qrData: QRData = {
    type: 'participant-checkin',
    id: crypto.randomUUID(),
    eventId,
    secret: crypto.randomUUID(), // Unique to this registration
  };
  
  // Use a single configurable expiration for QR tokens. Default to '30d' if not set.
  const qrExpiration = process.env.QR_EXPIRATION || '30d';

  const token = await new SignJWT(qrData)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(qrExpiration)
    .sign(SECRET_KEY);
  
  // Generate QR code image as data URL
  return QRCode.toDataURL(token);
}

// Verify a QR code and extract its data
export async function verifyQRCode(qrToken: string): Promise<QRData | null> {
  try {
    const { payload } = await jwtVerify(qrToken, SECRET_KEY);
    const qrData = payload as unknown as QRData;
    
    // Ensure it's a participant check-in code
    if (qrData.type !== 'participant-checkin') {
      console.error('Invalid QR code type:', qrData.type);
      return null;
    }
    
    return qrData;
  } catch (error) {
    console.error('Failed to verify QR code:', error);
    return null;
  }
}

// Generate a QR code string (not image) for database storage
export async function generateQRCodeForStorage(userId: string, eventId: string): Promise<string> {
  const qrData: QRData = {
    type: 'participant-checkin',
    id: crypto.randomUUID(),
    eventId,
    secret: crypto.randomUUID(),
  };
  
  // Use the same configurable expiration for storage QR tokens.
  const qrExpiration = process.env.QR_EXPIRATION || '30d';

  return new SignJWT(qrData)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(qrExpiration)
    .sign(SECRET_KEY);
}