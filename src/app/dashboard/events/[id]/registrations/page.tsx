'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface PageParams {
  params: Promise<{ id: string }>;
}

interface RegistrationWithUser {
  id: string;
  eventId: string;
  userId: string;
  responses: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'checked-in';
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface EventDetails {
  id: string;
  name: string;
  description: string;
  date: string;
  location: string;
  formSchema: {
    fields: Array<{
      id: string;
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  };
}

export default function PendingRegistrationsPage({ params }: PageParams) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const router = useRouter();
  const { data: session, status } = useSession();
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<RegistrationWithUser[]>([]);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'checked-in'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draftMessage, setDraftMessage] = useState<string>(`Hello!\nYou are invited to {EVENT_NAME}.\nPlease confirm your attendance by completing the payment and uploading the payment receipt using the payment confirmation form below.\n\nPayment confirmation form: https://forms.gle/\n\nPlease complete payment by the deadline.\n\nThanks,\nTeam`);
  const [csvUrl, setCsvUrl] = useState<string>('');
  const [csvRows, setCsvRows] = useState<Array<Record<string, string>>>([]);
  const [csvIndex, setCsvIndex] = useState<Record<string, Record<string, string>>>({});
  const [csvKeyField, setCsvKeyField] = useState<string>('SRN');
  const [csvLinkField, setCsvLinkField] = useState<string>('drive_link');
  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({});
  const [csvLoading, setCsvLoading] = useState<boolean>(false);
  const [mailBcc, setMailBcc] = useState<string>('');
  const [pageMessage, setPageMessage] = useState<{ type: 'info' | 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (csvUrl) return;
    const fetchServerCsv = async () => {
      try {
        const resp = await fetch('/api/env/csv');
        if (!resp.ok) {
          if (resp.status === 403) console.warn('CSV mailer link is restricted to admins/organizers');
          return;
        }
        const data = await resp.json();
        if (data?.csvMailerLink) setCsvUrl(String(data.csvMailerLink));
        if (data?.csvMailerPrimary && csvKeyField === 'SRN') {
          setCsvKeyField(String(data.csvMailerPrimary));
        }
      } catch {
        // ignore network errors
      }
    };
    fetchServerCsv();
  }, [csvUrl]);


  // Auto-fill BCC from the active filtered registrations
  useEffect(() => {
    const emails = filteredRegistrations.map(r => r.user?.email).filter(Boolean) as string[];
    setMailBcc(emails.join(','));
  }, [filteredRegistrations]);

  function cleanPhone(num?: string) {
    if (!num) return '';
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 10) return '91' + cleaned;
    return cleaned;
  }

  function getPhoneFromResponses(responses: Record<string, unknown>) {
    const candidates = ['Phone Number','phone','phone_number','Phone','PHONE','Mobile','mobile','mobile_number','contact','Contact Number'];
    for (const k of candidates) {
      if (k in responses) {
        const v = responses[k];
        if (v == null) continue;
        const asStr = String(v).trim();
        const cleaned = cleanPhone(asStr);
        if (cleaned) return cleaned;
      }
    }

    // Fallback: search any value for a digit sequence
    for (const [, v] of Object.entries(responses)) {
      if (v == null) continue;
      const s = String(v);
      const digits = s.replace(/\D/g, '');
      if (digits.length >= 7) {
        return cleanPhone(digits);
      }
    }

    return '';
  }

  function openWhatsApp(phone: string, message: string) {
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // Simple CSV parser (handles quoted fields)
  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [] as Array<Record<string, string>>;
    const parseLine = (line: string) => {
      const res: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) { res.push(cur); cur = ''; } else { cur += ch; }
      }
      res.push(cur);
      return res.map(s => s.trim());
    };

    const header = parseLine(lines[0]);
    return lines.slice(1).map(l => {
      const parts = parseLine(l);
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h] = parts[i] ?? ''; });
      return obj;
    });
  }

  function indexCsv(rows: Array<Record<string, string>>, keyField: string) {
    const idx: Record<string, Record<string, string>> = {};
    const normalizedKey = keyField.trim();
    rows.forEach(r => {
      // look up matching key in the row (case-sensitive and insensitive)
      let val = '';
      if (normalizedKey in r) val = r[normalizedKey];
      else {
        const foundKey = Object.keys(r).find(k => k.trim().toLowerCase() === normalizedKey.toLowerCase());
        if (foundKey) val = r[foundKey];
      }
      if (val) idx[String(val).trim()] = r;
    });
    return idx;
  }

  const fetchCsvUrl = useCallback(async (url?: string) => {
    const u = (url ?? csvUrl).trim();
    if (!u) { setPageMessage({ type: 'info', text: 'Enter a CSV URL' }); return; }
    setCsvLoading(true);
    try {
      const resp = await fetch(u);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const rows = parseCSV(text);
      setCsvRows(rows);
      setCsvIndex(indexCsv(rows, csvKeyField));
      setPageMessage({ type: 'success', text: `Loaded ${rows.length} rows from CSV` });
    } catch (err) {
      console.error('Failed to fetch CSV URL', err);
      setPageMessage({ type: 'error', text: `Failed to fetch CSV: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setCsvLoading(false);
    }
  }, [csvUrl, csvKeyField]);

  useEffect(() => {
    if (!csvUrl) return;
    if (csvRows.length > 0) return;
    void fetchCsvUrl();
  }, [csvUrl, csvRows.length, fetchCsvUrl]);

  function getPreviewUrlFromLink(link: string) {
    if (!link) return '';
    const s = link.trim();
    // Google Drive file id
    const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return `https://drive.google.com/file/d/${m[1]}/preview`;
    // shareable link with id= parameter
    const q = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (q && q[1]) return `https://drive.google.com/file/d/${q[1]}/preview`;
    // direct pdf
    if (s.endsWith('.pdf')) return s;
    return s; // fallback to open in iframe (may or may not work)
  }

  function buildGmailUrl(to: string[], bcc: string[], subject: string, body: string) {
    const params = new URLSearchParams();
    if (to.length) params.set('to', to.join(','));
    if (bcc.length) params.set('bcc', bcc.join(','));
    if (subject) params.set('su', subject);
    if (body) params.set('body', body);
    return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`;
  }
  
  // Fetch event data and ALL registrations
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event details
        const eventResponse = await fetch(`/api/events/${eventId}`);
        if (!eventResponse.ok) {
          throw new Error(`Failed to fetch event: ${eventResponse.status}`);
        }
        const eventData = await eventResponse.json();
        setEvent(eventData.event);
        
        // Fetch ALL registrations for this event
        const registrationsResponse = await fetch(`/api/events/${eventId}/registrations`);
        if (!registrationsResponse.ok) {
          throw new Error(`Failed to fetch registrations: ${registrationsResponse.status}`);
        }
        const registrationsData = await registrationsResponse.json();
        setRegistrations(registrationsData.registrations || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (status !== 'loading') {
      fetchData();
    }
  }, [eventId, status]);

  // When event loads, substitute {EVENT_NAME} token in the draft message if present
  useEffect(() => {
    if (event && draftMessage.includes('{EVENT_NAME}')) {
      setDraftMessage(prev => prev.replace('{EVENT_NAME}', event.name));
    }
  }, [event, draftMessage]);

  
  // Filter registrations based on status
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const byStatus = statusFilter === 'all' ? registrations : registrations.filter(reg => reg.status === statusFilter);
    if (!q) {
      setFilteredRegistrations(byStatus);
      return;
    }

    const matches = byStatus.filter(reg => {
      if (reg.user?.name && String(reg.user.name).toLowerCase().includes(q)) return true;
      if (reg.user?.email && String(reg.user.email).toLowerCase().includes(q)) return true;
      if (String(reg.id).toLowerCase().includes(q)) return true;
      for (const v of Object.values(reg.responses || {})) {
        if (v == null) continue;
        if (String(v).toLowerCase().includes(q)) return true;
      }
      return false;
    });

    setFilteredRegistrations(matches);
  }, [registrations, statusFilter, searchQuery]);
  
  // Redirect if not authenticated or not organizer/admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/dashboard/events/${eventId}/registrations`);
    } else if (status === 'authenticated' && 
               session.user.role !== 'admin' && 
               session.user.role !== 'organizer') {
      router.push('/dashboard');
    }
  }, [status, session, router, eventId]);

  const handleApprove = async (registrationId: string) => {
    setProcessingId(registrationId);
    try {
      const response = await fetch('/api/events/registrations/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registrationId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve registration');
      }
      
      // Update the local state - don't remove, just update status
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: 'approved' as const }
            : reg
        )
      );
    } catch (err) {
      console.error('Error approving registration:', err);
      setPageMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to approve registration' });
    } finally {
      setProcessingId(null);
    }
  };
  
  const handleReject = async (registrationId: string) => {
    setProcessingId(registrationId);
    try {
      const response = await fetch('/api/events/registrations/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registrationId }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject registration');
      }
      
      // Update the local state - don't remove, just update status
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: 'rejected' as const }
            : reg
        )
      );
    } catch (err) {
      console.error('Error rejecting registration:', err);
      setPageMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to reject registration' });
    } finally {
      setProcessingId(null);
    }
  };
  
  if (status === 'loading' || loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-medium">Error: {error || 'Event not found'}</p>
        </div>
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800">
          ← Back to all events
        </Link>
      </div>
    );
  }


  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page-level message banner */}
      {pageMessage && (
        <div className={`mb-4 px-4 py-3 rounded ${pageMessage.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : pageMessage.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          <div className="flex justify-between items-center">
            <div>{pageMessage.text}</div>
            <button onClick={() => setPageMessage(null)} className="text-sm underline">Dismiss</button>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Event Registrations</h1>
        <div className="flex gap-3">
          <Link 
            href={`/dashboard/events/${eventId}`}
            className="text-indigo-600 hover:text-indigo-800 flex items-center"
          >
            ← Back to Event Details
          </Link>
        </div>
      </div>

      {/* Inline WhatsApp draft + per-registration send (organizers/admins) */}
      {session?.user?.role && ['admin', 'organizer'].includes(session.user.role) && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-3">WhatsApp+Mail Draft</h3>
          <textarea
            value={draftMessage}
            onChange={e => setDraftMessage(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-md p-3 mb-4 min-h-[120px] text-sm"
          />

          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-4">
              <label className="text-sm block mb-1 text-gray-700">Primary key column (e.g. SRN)</label>
              <input value={csvKeyField} onChange={e => setCsvKeyField(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
            </div>
            <div className="col-span-4">
              <label className="text-sm block mb-1 text-gray-700">Drive link column</label>
              <input value={csvLinkField} onChange={e => setCsvLinkField(e.target.value)} className="w-full border border-gray-300 rounded-md p-2" />
            </div>
            <div className="col-span-4 flex items-center gap-3">
              <input value={csvUrl} onChange={e => setCsvUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv" className="w-full border border-gray-300 rounded-md p-2 text-sm" />
              <button
                onClick={() => fetchCsvUrl()}
                disabled={csvLoading}
                className="px-4 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${csvLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm">{csvLoading ? 'Fetching...' : 'Fetch CSV'}</span>
              </button>
            </div>

            <div className="col-span-12 text-sm text-gray-600 mt-2">Use the Send button on each registration to open WhatsApp with the draft message. If a CSV row matches this registration key, a Preview button will appear to preview the Drive PDF.</div>
            <div className="col-span-12 mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm mr-2">Mail BCC (auto-filled from filter)</label>
              <input value={mailBcc} onChange={e => setMailBcc(e.target.value)} placeholder="team1@example.com,team2@example.com" className="flex-1 border border-gray-300 rounded-md p-2 text-sm" />
              <button
                onClick={() => {
                  // Put recipients from the active filter into BCC (user asked for BCC everyone)
                  const bccEmails = filteredRegistrations.map(r => r.user?.email).filter(Boolean) as string[];
                  if (bccEmails.length === 0) { setPageMessage({ type: 'info', text: 'No recipients found for current filter' }); return; }
                  const subject = `Update on ${event?.name || 'event'}`;
                  const gmailUrl = buildGmailUrl([], bccEmails, subject, draftMessage);
                  window.open(gmailUrl, '_blank');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                📧 Mail All (BCC)
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">{event.name}</h2>
        <p className="text-gray-600 mb-4">
          {new Date(event.date).toLocaleDateString()} at {event.location}
        </p>
        
        {/* Search + Status Filter */}
        <div className="mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, id, or response"
            className="w-full sm:w-1/2 border border-gray-300 rounded-md p-2 mb-3 sm:mb-0"
          />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All ({registrations.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending ({registrations.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Approved ({registrations.filter(r => r.status === 'approved').length})
          </button>
          <button
            onClick={() => setStatusFilter('checked-in')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'checked-in'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Checked In ({registrations.filter(r => r.status === 'checked-in').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              statusFilter === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Rejected ({registrations.filter(r => r.status === 'rejected').length})
          </button>
        </div>
      </div>
      
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-500">
            No {statusFilter === 'all' ? '' : statusFilter} registrations found.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredRegistrations.map((registration) => {
            const statusColors = {
              pending: 'bg-amber-100 text-amber-800',
              approved: 'bg-green-100 text-green-800',
              rejected: 'bg-red-100 text-red-800',
              'checked-in': 'bg-blue-100 text-blue-800'
            };
            
            return (
              <div key={registration.id} className="bg-white shadow-md rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">
                        {registration.user?.name || 'Unknown User'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[registration.status]}`}>
                        {registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-gray-500">{registration.user?.email}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Registered on {new Date(registration.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="space-x-3">
                    {registration.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(registration.id)}
                          disabled={processingId === registration.id}
                          className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingId === registration.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(registration.id)}
                          disabled={processingId === registration.id}
                          className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingId === registration.id ? 'Processing...' : 'Reject'}
                        </button>
                      </>
                    )}

                    {/* WhatsApp send button */}
                    {session?.user?.role && ['admin', 'organizer'].includes(session.user.role) && (
                      (() => {
                        const phone = getPhoneFromResponses(registration.responses);
                        return phone ? (
                          <button
                            onClick={() => openWhatsApp(phone, draftMessage)}
                            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600"
                          >
                            📱 Send
                          </button>
                        ) : (
                          <button className="px-3 py-1 bg-gray-200 text-gray-600 rounded-md cursor-not-allowed" disabled>
                            No Phone
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>
                
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-medium mb-2">Registration Responses:</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries(registration.responses).map(([key, value]) => {
                      const field = event.formSchema.fields.find(f => f.name === key);
                      const label = field?.label || key;
                      const stringValue = String(value);
                      
                      // Check if it's a Google Drive link
                      const isGoogleDriveLink = stringValue.includes('drive.google.com');
                      
                      return (
                        <div key={key} className="flex flex-col">
                          <dt className="text-gray-500 text-sm">{label}:</dt>
                              <dd className="font-medium">
                                {isGoogleDriveLink ? (
                                  <a
                                    href={stringValue}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline"
                                  >
                                    {stringValue}
                                  </a>
                                ) : /^https?:\/\//i.test(stringValue) ? (
                                  <a
                                    href={stringValue}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline"
                                  >
                                    {stringValue}
                                  </a>
                                ) : (
                                  stringValue
                                )}
                              </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
                {/* CSV-driven preview if available */}
                {(() => {
                  // Determine this registration's key value (try SRN or other common fields)
                  const keyCandidates = ['SRN','srn','srn_number','roll','Roll','registration_number','Registration Number'];
                  let regKeyVal = '';
                  for (const k of keyCandidates) {
                    if (k in registration.responses) { regKeyVal = String(registration.responses[k] ?? '').trim(); break; }
                  }
                  // Fallback: check user email or user id
                  if (!regKeyVal) regKeyVal = registration.user?.email ?? '';

                  const csvRow = csvIndex[regKeyVal] || csvIndex[regKeyVal.toUpperCase?.() ?? ''] || csvIndex[regKeyVal.toLowerCase?.() ?? ''];
                  if (!csvRow) return null;

                  const rawLink = csvRow[csvLinkField] ?? csvRow[csvLinkField.trim()] ?? Object.values(csvRow).find(v => String(v).includes('drive.google.com')) ?? '';
                  const previewUrl = rawLink ? getPreviewUrlFromLink(String(rawLink)) : '';

                  return (
                    <div className="mt-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPreviewOpen(prev => ({ ...prev, [registration.id]: !prev[registration.id] }))}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          {previewOpen[registration.id] ? 'Hide Preview' : 'Preview Drive PDF'}
                        </button>
                        {previewUrl ? (
                          <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm text-gray-600 underline">Open original</a>
                        ) : null}
                      </div>

                      {previewOpen[registration.id] && previewUrl && (
                        <div className="mt-3 border rounded overflow-hidden h-[320px] md:h-[60vh] lg:h-[50vh] xl:h-[45vh]">
                          <iframe src={previewUrl} className="w-full h-full" />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Show CSV-only (missing) rows: rows present in CSV but not matched to any registration */}
      {csvRows.length > 0 && (
        <div className="mt-8 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">CSV-only rows (not found on platform)</h2>
          {(() => {
            // build a set of matched keys from registrations
            const matchedKeys = new Set<string>();
            const keyCandidates = ['SRN','srn','srn_number','roll','Roll','registration_number','Registration Number'];
            for (const reg of registrations) {
              let val = '';
              for (const k of keyCandidates) {
                if (k in reg.responses) { val = String(reg.responses[k] ?? '').trim(); break; }
              }
              if (!val && reg.user?.email) val = reg.user.email;
              if (val) matchedKeys.add(val);
            }

            const missing = csvRows.filter(r => {
              const key = r[csvKeyField] ?? r[csvKeyField.trim()] ?? r['SRN'] ?? r['srn'] ?? '';
              return key && !matchedKeys.has(String(key).trim());
            });

            if (missing.length === 0) return <p className="text-gray-600">No missing rows — all CSV entries matched existing registrations.</p>;

            return (
              <div className="space-y-3">
                {missing.map((row, idx) => {
                  const keyVal = (row[csvKeyField] ?? row[csvKeyField.trim()] ?? row['SRN'] ?? row['srn'] ?? '') as string;
                  const link = (row[csvLinkField] ?? '') as string;
                  const phone = cleanPhone((row['phone'] ?? row['Phone'] ?? row['mobile'] ?? row['Mobile'] ?? '') as string);
                  return (
                    <div key={idx} className="flex justify-between items-center border rounded p-3">
                      <div>
                        <div className="font-medium">{keyVal || '—'}</div>
                        <div className="text-sm text-gray-600">{link}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {phone ? (
                          <button onClick={() => openWhatsApp(phone, draftMessage)} className="px-3 py-1 bg-green-500 text-white rounded-md">📱 Send</button>
                        ) : (
                          <span className="text-sm text-gray-500">No phone</span>
                        )}
                        {link ? <a href={getPreviewUrlFromLink(link)} target="_blank" rel="noreferrer" className="text-sm text-gray-600 underline">Preview</a> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}