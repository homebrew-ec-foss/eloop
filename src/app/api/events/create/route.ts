import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createEvent } from '@/lib/db/event';
import { hasOrganizerPrivileges } from '@/lib/db/user';
import { FormField, FormSchema } from '@/types';
import { z } from 'zod';

// Schema validation for form fields
const formFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'email', 'select', 'multiselect', 'checkbox', 'date', 'time']),
  required: z.boolean(),
  order: z.number().int().min(0),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional().default(""),
  useUserProfile: z.boolean().optional(),
  userProfileField: z.enum(['name', 'email', 'custom']).optional(),
  validation: z.object({
    pattern: z.string().optional(),
    message: z.string().optional()
  }).optional()
});

// Schema validation for event creation
const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  description: z.string().optional().default(""),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  registrationCloseDate: z.string().datetime().optional(),
  location: z.string().optional().default(""),
  imageUrl: z.string().url().optional().or(z.literal('')),
  checkpoints: z.array(z.string()).default(["Registration"]),
  formFields: z.array(formFieldSchema)
});

// Create new event
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Only admin or organizer can create events
    const canCreateEvent = await hasOrganizerPrivileges(session.user.id);
    if (!canCreateEvent) {
      return NextResponse.json(
        { error: 'Organizer privileges required' },
        { status: 403 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    
    console.log("Event creation request body:", JSON.stringify({
      name: body.name,
      description: body.description,
      startDate: body.startDate,
      endDate: body.endDate,
      registrationCloseDate: body.registrationCloseDate,
      location: body.location,
      checkpoints: body.checkpoints,
      formFieldCount: body.formFields?.length || 0,
      formFieldSample: body.formFields && body.formFields.length > 0 ? 
        JSON.stringify(body.formFields[0]) : 'No fields'
    }));
    
    if (!body.formFields || !Array.isArray(body.formFields)) {
      console.error("Form fields are missing or not an array:", body.formFields);
      return NextResponse.json(
        { 
          error: 'Invalid event data', 
          message: 'Form fields are missing or invalid'
        },
        { status: 400 }
      );
    }
    
    // Log all form fields for debugging
    console.log("Form fields:");
    body.formFields.forEach((field: Record<string, unknown>, index: number) => {
      console.log(`Field ${index}:`, {
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required
      });
    });
    
    const validationResult = createEventSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("Validation error:", JSON.stringify(validationResult.error.format(), null, 2));
      
      const errorMessage = Object.entries(validationResult.error.format())
        .filter(([key]) => key !== '_errors')
        .map(([key, value]) => {
          const errorObj = value as { _errors?: string[] };
          return `${key}: ${errorObj._errors?.join(', ') || 'Invalid'}`;
        })
        .join('; ');
        
      return NextResponse.json(
        { 
          error: 'Invalid event data', 
          message: errorMessage || 'Validation failed',
          details: validationResult.error.format() 
        },
        { status: 400 }
      );
    }
    
    const { name, description, startDate, endDate, registrationCloseDate, location, imageUrl, checkpoints, formFields } = validationResult.data;
    
    // Ensure all field IDs are valid UUIDs
    const normalizedFields = formFields.map(field => {
      // If the ID is not a UUID, replace it with one
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(field.id);
      
      return {
        ...field,
        id: isUUID ? field.id : crypto.randomUUID(),
        placeholder: field.placeholder || ""
      };
    });
    
    // Create form schema
    const formSchemaId = crypto.randomUUID();
    const formSchema: FormSchema = {
      id: formSchemaId,
      eventId: '', // Will be set after event creation
      fields: normalizedFields as FormField[],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create event
    const event = await createEvent({
      name,
      description,
      date: new Date(startDate), // Use startDate as the main date for backward compatibility
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      registrationCloseDate: registrationCloseDate ? new Date(registrationCloseDate) : undefined,
      location,
      imageUrl: imageUrl || undefined,
      checkpoints,
      organizerId: session.user.id,
      formSchema
    });
    
    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        date: event.date,
        startDate: event.startDate,
        endDate: event.endDate,
        registrationCloseDate: event.registrationCloseDate,
        location: event.location,
        checkpoints: event.checkpoints
      }
    });
  } catch (error) {
    console.error('Create event error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        error: 'Failed to create event',
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}