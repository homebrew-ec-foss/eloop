'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApprovalMessage } from '@/lib/approvalMessage';
import { Event, FormField } from '@/types';
import { RenderFormField, validateField } from '@/components/forms/FieldRenderer';

interface PageParams {
  params: Promise<{ id: string }>;
}

export default function EventRegistrationPage({ params }: PageParams) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const { data: session, status } = useSession();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [drivePublicConfirmed, setDrivePublicConfirmed] = useState<Record<string, boolean>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dataFetched, setDataFetched] = useState(false);
  // State to track if user has already registered
  const [userRegistration, setUserRegistration] = useState<{
    registered: boolean;
    status?: 'pending' | 'approved' | 'rejected' | 'checked-in';
  } | null>(null);

  // Whether the current user is NOT allowed to register (only applicants may register)
  const [cannotRegister, setCannotRegister] = useState(false);

  const approvalMessageHtml = getApprovalMessage(session?.user?.email || '');
  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(`/register/${eventId}`)}`);
    }
  }, [status, router, eventId]);

  // Check whether the current user can register; only applicants may submit registrations
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      setCannotRegister(session.user.role !== 'applicant');
    } else {
      setCannotRegister(false);
    }
  }, [status, session]);

  // Fetch event data and check registration status
  useEffect(() => {
    // If we're still determining auth status, don't fetch yet
    if (status === 'loading') return;

    // If we've already fetched the data, don't fetch again
    if (dataFetched) return;

    const fetchData = async () => {
      try {
        // Fetch event data
        const eventResponse = await fetch(`/api/events/${eventId}`);

        if (!eventResponse.ok) {
          throw new Error(`Failed to fetch event: ${eventResponse.status}`);
        }

        const eventData = await eventResponse.json();
        setEvent(eventData.event);

        // Pre-fill form values from user profile if fields are configured to use it
        if (status === 'authenticated' && session?.user) {
          const formFieldsWithUserProfile = eventData.event.formSchema.fields.filter(
            (field: FormField) => field.useUserProfile && field.userProfileField
          );

          // Use function update pattern to avoid dependency on formValues
          setFormValues(prevValues => {
            const newValues = { ...prevValues };

            formFieldsWithUserProfile.forEach((field: FormField) => {
              if (field.userProfileField === 'email' && session.user.email) {
                newValues[field.name] = session.user.email;
              } else if (field.userProfileField === 'name' && session.user.name) {
                newValues[field.name] = session.user.name;
              }
            });

            return newValues;
          });
        }

        // Only check registration status if user is logged in and we don't already have the status
        if (status === 'authenticated' && userRegistration === null) {
          // Check if user has already registered
          const registrationResponse = await fetch(`/api/events/${eventId}/registration-status`);

          if (registrationResponse.ok) {
            const registrationData = await registrationResponse.json();
            setUserRegistration(registrationData);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch event data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setDataFetched(true);
  }, [eventId, status, session?.user, userRegistration, dataFetched]); //Added userRegistration to dependencies

  const handleInputChange = (fieldName: string, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldName]: value }));

    // Clear validation error for this field when user starts typing
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateAllFields = (): boolean => {
    if (!event?.formSchema?.fields) return true;

    const errors: Record<string, string> = {};

    event.formSchema.fields.forEach((field: FormField) => {
      const value = formValues[field.name] || '';
      const error = validateField(field, value);
      if (error) {
        errors[field.name] = error;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user) {
      setSubmitError('You must be logged in to register');
      return;
    }

    // Prevent non-applicants from registering
    if (session.user.role !== 'applicant') {
      setSubmitError('Only applicants can register for events.');
      setSubmitStatus('error');
      return;
    }

    // Validate all fields before submission
    if (!validateAllFields()) {
      setSubmitError('Please fix the validation errors below');
      return;
    }

    // Check Google Drive link public confirmations
    const driveFields = event?.formSchema?.fields.filter(
      (field: FormField) => field.validation?.pattern && field.validation.pattern.includes('drive.google.com')
    );

    if (driveFields && driveFields.length > 0) {
      for (const field of driveFields) {
        const hasValue = formValues[field.name];
        const isConfirmed = drivePublicConfirmed[field.name];

        if (hasValue && !isConfirmed) {
          setSubmitError(`Please confirm that your ${field.label} is set to public access`);
          // Scroll to the field
          const fieldElement = document.getElementById(field.name);
          if (fieldElement) {
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }
    }

    try {
      setSubmitStatus('submitting');
      setSubmitError(null);

      const response = await fetch('/api/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
          responses: formValues,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register for the event');
      }

      setSubmitStatus('success');

      // Redirect to dashboard (show success there) immediately — remove interstitial page
      try {
        await router.push(`/dashboard?registration=success&event=${encodeURIComponent(event?.name || '')}`);
      } catch (err) {
        console.warn('Navigation to dashboard failed after registration', err);
      }
      return;
    } catch (err) {
      console.error('Registration error:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to register');
      setSubmitStatus('error');
    }
  };

  // Show loading state
  if (status === 'loading' || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-0 md:pt-12 pb-6 md:pb-12">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }


  // Check if registration is closed
  if (event && event.isRegistrationOpen === false) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-0 md:pt-12 pb-6 md:pb-12">
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <svg className="h-6 w-6 text-amber-600 mr-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-amber-900 mb-2">Registration Currently Closed</h2>
              <p className="text-amber-800 mb-2">
                Registration for <strong>{event.name}</strong> is currently closed.
              </p>
              <p className="text-amber-700 text-sm">
                Please check back later or contact the event organizers for more information.
              </p>
            </div>
          </div>
        </div>

        {/* Show event details even when closed */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">{event.name}</h1>
          <div className="space-y-3 text-gray-700">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}</span>
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{event.location}</span>
            </div>
            {event.description && (
              <div className="mt-4">
                <p className="text-gray-700 whitespace-pre-line">{event.description}</p>
              </div>
            )}
          </div>
        </div>

        <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-0 md:pt-12 pb-6 md:pb-12">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-medium">Error: {error || 'Event not found'}</p>
          <p>The event you&apos;re looking for might have been removed or doesn&apos;t exist.</p>
        </div>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">
          ← Back to home
        </Link>
      </div>
    );
  }

  // Format the date for display
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate duration if start and end dates are available
  const calculateDuration = () => {
    if (!event.startDate || !event.endDate) return null;

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min`;
    } else if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} min`;
    }
  };

  const duration = calculateDuration();



  // Authentication check
  if (status === 'unauthenticated') {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-0 md:pt-12 pb-6 md:pb-12">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p>You need to be logged in to register for this event.</p>
          <p className="mt-2">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-0 md:pt-12 pb-6 md:pb-12">
      {/* Banner Image */}
      {event.imageUrl && (
        <div className="mb-8 -mx-6 -mt-6">
          <div className="max-w-6xl mx-auto overflow-hidden rounded-lg shadow-lg">
            <img
              src={event.imageUrl}
              alt={`${event.name} banner`}
              loading="lazy"
              decoding="async"
              className="w-full h-64 sm:h-72 md:h-96 lg:h-[420px] object-cover object-center"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/dashboard/events" className="text-sm text-indigo-600 hover:underline inline-flex items-center gap-2">← Back to Events</Link>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mt-2">{event.name}</h1>
              {event.description && (
                <p className="text-sm text-slate-500 mt-1 hidden sm:block">{event.description}</p>
              )}
            </div>

            <div className="hidden sm:flex items-center">
              <button className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">Registrations</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide font-medium text-slate-500">Date & Time</p>
            <p className="text-lg font-semibold text-slate-900">{formattedDate}</p>
            <p className="text-sm text-slate-600">at {formattedTime}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-2">
            <p className="text-xs uppercase tracking-wide font-medium text-slate-500">Location</p>
            <p className="text-lg font-semibold text-slate-900">{event.location}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">Event Description</h2>
        <p className="whitespace-pre-line">{event.description}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6">Registration Form</h2>

        {/* Show banner for users who can view but cannot register (e.g., organizers) */}
        {cannotRegister && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">You are not allowed to register for events.</p>
            <p className="text-sm mt-1">Only applicants can register for events.</p>
          </div>
        )}

        {/* Show registration status if user has already registered */}
        {userRegistration?.registered ? (
          <div className="mb-6">
            {userRegistration.status === 'pending' && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">Your registration is pending approval</p>
                    <p className="text-sm mt-1">You have already registered for this event. The organizer will review your registration.</p>
                  </div>
                </div>
              </div>
            )}

            {userRegistration.status === 'approved' && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-medium">Your registration has been approved!</p>
                    <p className="text-sm mt-1">You are registered for this event. Check your dashboard for the QR code.</p>
                  </div>
                </div>
              </div>
            )}

            {userRegistration.status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div>
                    <p className="font-medium">Your registration was not approved</p>
                    <p className="text-sm mt-1">Unfortunately, your registration for this event was not approved.</p>
                  </div>
                </div>
              </div>
            )}

            {userRegistration.status === 'checked-in' && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">You have checked in to this event</p>
                    <p className="text-sm mt-1">You are checked in and registered for this event.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Link href="/dashboard/registrations" className="text-indigo-600 hover:text-indigo-800">
                View all your registrations →
              </Link>
            </div>
          </div>
        ) : (
          <>
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                <p>{submitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {event.formSchema?.fields?.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {event.formSchema.fields.map((field: FormField) => (
                      <div key={field.id} className="space-y-2">
                        <label
                          htmlFor={field.name}
                          className="block text-sm font-medium text-gray-700"
                        >
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>

                        <RenderFormField field={field} value={formValues[field.name] || ''} onChange={handleInputChange} validationErrors={validationErrors} />

                        {/* Google Drive link public access confirmation checkbox */}
                        {field.validation?.pattern && field.validation.pattern.includes('drive.google.com') && formValues[field.name] && formValues[field.name].includes('drive.google.com') && (
                          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-3">
                            <div className="flex items-start mb-2">
                              <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">Verify your link is publicly accessible</p>
                                <a
                                  href={formValues[field.name]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 underline inline-flex items-center mt-1"
                                >
                                  Open link in new tab to verify
                                  <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                            <label className="flex items-start cursor-pointer">
                              <input
                                type="checkbox"
                                checked={drivePublicConfirmed[field.name] || false}
                                onChange={(e) => setDrivePublicConfirmed({
                                  ...drivePublicConfirmed,
                                  [field.name]: e.target.checked
                                })}
                                required={field.required && !!formValues[field.name]}
                                className="mt-0.5 mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 rounded"
                              />
                              <span className="text-sm text-gray-800">
                                <span className="font-medium">✓ I confirm this Google Drive file is set to <strong className="text-yellow-800">PUBLIC ACCESS</strong></span>
                                <span className="block text-xs text-gray-600 mt-1">(Right-click file → Share → General access → Anyone with the link)</span>
                              </span>
                            </label>
                          </div>
                        )}

                        {/* Show validation error */}
                        {validationErrors[field.name] && (
                          <p className="text-sm text-red-600 mt-1">
                            {validationErrors[field.name]}
                          </p>
                        )}

                        {/* Show validation hint if pattern exists */}
                        {field.validation?.pattern && !validationErrors[field.name] && (
                          <p className="text-xs text-gray-500 mt-1">
                            {field.validation.message || 'Please match the required format'}
                          </p>
                        )}
                      </div>
                    ))}

                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500">Please ensure all fields are filled correctly before submitting</div>
                    <button
                      type="submit"
                      disabled={submitStatus === 'submitting' || cannotRegister}
                      className="px-5 py-3 rounded-full bg-indigo-600 text-white text-base hover:bg-indigo-700 shadow-md disabled:opacity-50"
                    >
                      {cannotRegister ? 'Registration not allowed' : (submitStatus === 'submitting' ? 'Submitting...' : 'Submit')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">This event doesn&apos;t have a registration form.</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

