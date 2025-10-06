// Define role types
export type UserRole = 'admin' | 'organizer' | 'volunteer' | 'participant' | 'applicant';

// User profile structure
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizerId?: string; // Reference to organizer if volunteer
  createdAt: Date;
  updatedAt: Date;
}

// Event structure
export interface Event {
  id: string;
  name: string;
  description: string;
  date: Date; // Main date for compatibility with existing code
  startDate?: Date;
  endDate?: Date;
  registrationCloseDate?: Date;
  location: string;
  imageUrl?: string; // Event preview image URL
  organizerId: string;
  checkpoints?: string[];
  unlockedCheckpoints?: string[]; // Checkpoints that are currently unlocked for scanning
  isRegistrationOpen?: boolean; // Whether new registrations are accepted
  formSchema: FormSchema;
  createdAt: Date;
  updatedAt: Date;
}

// Form schema for dynamic form generation
export interface FormSchema {
  id: string;
  eventId: string;
  fields: FormField[];
  createdAt: Date;
  updatedAt: Date;
}

// Form field types
export type FieldType = 'text' | 'number' | 'email' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'time';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string[]; // For select and multiselect fields
  placeholder?: string;
  useUserProfile?: boolean; // Whether to pull this field from user profile data
  userProfileField?: 'name' | 'email' | 'custom'; // Which field from the user profile to use
  validation?: {
    pattern?: string; // Regex pattern for validation
    message?: string; // Custom error message
  };
}

// Registration status types
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'checked-in';

// Checkpoint check-in record
export interface CheckpointCheckIn {
  checkpoint: string;
  checkedInBy: string;
  checkedInAt: Date;
}

// Registration structure
export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  responses: Record<string, unknown>; // JSON data of form responses
  status: RegistrationStatus;
  qrCode: string; // QR code identifier
  checkpointCheckIns: CheckpointCheckIn[]; // Track check-ins for each checkpoint
  approvedBy?: string; // Reference to admin/organizer who approved
  approvedAt?: Date;
  rejectedBy?: string; // Reference to admin/organizer who rejected
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// QR code data structure
export interface QRData {
  type: 'participant-checkin';
  id: string;
  eventId: string;
  secret: string;
  [key: string]: unknown; // To make it compatible with JWTPayload
}

// Analytics structure
export interface EventAnalytics {
  eventId: string;
  registrationCount: number;
  checkinCount: number;
  checkinRate: number;
  fieldResponses: Record<string, unknown>; // Aggregated responses for analytics
}

// Scan log types
export type ScanStatus = 'success' | 'error' | 'invalid_qr' | 'not_found' | 'wrong_checkpoint' | 'already_checked_in' | 'not_approved';

// Scan log structure for tracking all scan attempts
export interface ScanLog {
  id: string;
  eventId: string;
  volunteerId: string;
  volunteerName?: string; // For display
  qrCode?: string;
  checkpoint: string;
  scanStatus: ScanStatus;
  errorMessage?: string;
  userId?: string; // If QR was valid and user was found
  userName?: string; // For display
  registrationId?: string; // If registration was found
  createdAt: Date;
}