import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getEventById, updateEventFormSchema } from '@/lib/db/event';
import { hasOrganizerPrivileges } from '@/lib/db/user';
import { FormField, FormSchema } from '@/types';
import { z } from 'zod';

// Schema validation for form fields
const formFieldSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'email', 'select', 'multiselect', 'checkbox', 'date', 'time']),
  required: z.boolean(),
  order: z.number().int().min(0),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional()
});

// Schema validation for form schema update
const updateFormSchema = z.object({
  eventId: z.string().uuid(),
  fields: z.array(formFieldSchema)
});

// Update event form schema
export async function PUT(request: Request) {
  try {
    const session = await auth();
    
    // User must be logged in
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateFormSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: validationResult.error.format() },
        { status: 400 }
      );
    }
    
    const { eventId, fields } = validationResult.data;
    
    // Get event to check permissions
    const event = await getEventById(eventId);
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Check if user has permission to update this event
    const isOrganizer = await hasOrganizerPrivileges(session.user.id);
    const isEventOwner = event.organizerId === session.user.id;
    
    if (!isOrganizer || (session.user.role === 'organizer' && !isEventOwner)) {
      return NextResponse.json(
        { error: 'You do not have permission to update this event' },
        { status: 403 }
      );
    }
    
    // Update the form schema
    const newFormSchema: FormSchema = {
      id: event.formSchema.id,
      eventId,
      fields: fields as FormField[],
      createdAt: event.formSchema.createdAt,
      updatedAt: new Date()
    };
    
    const updatedEvent = await updateEventFormSchema(eventId, newFormSchema);
    
    return NextResponse.json({
      success: true,
      formSchema: updatedEvent?.formSchema
    });
  } catch (error) {
    console.error('Update form schema error:', error);
    return NextResponse.json(
      { error: 'Failed to update form schema' },
      { status: 500 }
    );
  }
}