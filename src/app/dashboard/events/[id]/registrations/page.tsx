'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [registrations, setRegistrations] = useState<RegistrationWithUser[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<RegistrationWithUser[]>([]);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const initialFilter = (searchParams.get('status') as 'all' | 'pending' | 'approved' | 'rejected' | 'checked-in') || 'all';
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'checked-in'>(initialFilter);
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
    const candidates = ['Phone Number', 'phone', 'phone_number', 'Phone', 'PHONE', 'Mobile', 'mobile', 'mobile_number', 'contact', 'Contact Number'];
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
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
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
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (status !== 'loading') {
      fetchData();
    }
  }, [status, fetchData]);

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
      <div className="space-y-6 md:space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded-lg w-1/2"></div>
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl">
          <p className="font-medium">Error: {error || 'Event not found'}</p>
        </div>
        <Link href="/dashboard/events" className="text-indigo-600 hover:text-indigo-800 font-medium">
          ← Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page-level message banner */}
      {pageMessage && (
        <div className={`px-5 py-4 rounded-2xl flex justify-between items-center ${pageMessage.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : pageMessage.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          <div>{pageMessage.text}</div>
          <button onClick={() => setPageMessage(null)} className="text-sm font-medium hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Registrations</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">{event.name}</h1>
          <p className="text-slate-600">
            {new Date(event.date).toLocaleDateString()} • {event.location}
          </p>
        </div>
        <Link
          href={`/dashboard/events/${eventId}`}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:border-slate-300"
        >
          ← Back
        </Link>
      </div>

      {/* Inline WhatsApp draft + per-registration send (organizers/admins) */}
      {session?.user?.role && ['admin', 'organizer'].includes(session.user.role) && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Messaging</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1">WhatsApp + Email Draft</h3>
          </div>
          <textarea
            value={draftMessage}
            onChange={e => setDraftMessage(e.target.value)}
            rows={5}
            className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-600 block mb-1 font-medium">Primary key (e.g. SRN)</label>
              <input value={csvKeyField} onChange={e => setCsvKeyField(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1 font-medium">Drive link column</label>
              <input value={csvLinkField} onChange={e => setCsvLinkField(e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1 font-medium">CSV URL</label>
              <div className="flex gap-2">
                <input value={csvUrl} onChange={e => setCsvUrl(e.target.value)} placeholder="https://docs.google.com/..." className="flex-1 border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                <button
                  onClick={() => fetchCsvUrl()}
                  disabled={csvLoading}
                  className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50 font-medium text-sm"
                >
                  {csvLoading ? '...' : '↻'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm text-slate-600 block mb-1 font-medium">Mail BCC (auto-filled)</label>
              <input value={mailBcc} onChange={e => setMailBcc(e.target.value)} placeholder="team@example.com" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <button
              onClick={() => {
                const bccEmails = filteredRegistrations.map(r => r.user?.email).filter(Boolean) as string[];
                if (bccEmails.length === 0) { setPageMessage({ type: 'info', text: 'No recipients' }); return; }
                const subject = `Update on ${event?.name || 'event'}`;
                const gmailUrl = buildGmailUrl([], bccEmails, subject, draftMessage);
                window.open(gmailUrl, '_blank');
              }}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm self-end"
            >
              📧 Email All
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
          <div>
            <label htmlFor="search" className="text-sm text-slate-600 block mb-1 font-medium">Search registrations</label>
            <input
              id="search"
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Name, email, or field response"
              className="w-full md:w-80 border border-slate-200 rounded-xl p-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {[
            { key: 'all', label: 'All', count: registrations.length },
            { key: 'pending', label: 'Pending', count: registrations.filter(r => r.status === 'pending').length },
            { key: 'approved', label: 'Approved', count: registrations.filter(r => r.status === 'approved').length },
            { key: 'checked-in', label: 'Checked In', count: registrations.filter(r => r.status === 'checked-in').length },
            { key: 'rejected', label: 'Rejected', count: registrations.filter(r => r.status === 'rejected').length },
          ].map(({ key, label, count }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setStatusFilter(key as any);
                  const params = new URLSearchParams(window.location.search);
                  params.set('status', key);
                  router.push(`?${params.toString()}`, { scroll: false });
                }}
                className={`px-3 py-2 rounded-full text-sm font-medium border transition ${active
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-200'
                  }`}
              >
                {label} ({count})
              </button>
            );
          })}
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="ml-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 disabled:opacity-50 font-medium text-sm transition inline-flex items-center gap-1.5"
            title="Refresh registrations"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {filteredRegistrations.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500">
          No {statusFilter === 'all' ? '' : statusFilter} registrations found.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRegistrations.map((registration) => {
            const statusColors = {
              pending: 'bg-amber-100 text-amber-800',
              approved: 'bg-emerald-100 text-emerald-800',
              rejected: 'bg-rose-100 text-rose-800',
              'checked-in': 'bg-blue-100 text-blue-800'
            };

            return (
              <div key={registration.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {registration.user?.name || 'Unknown'}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[registration.status]}`}>
                        {registration.status === 'checked-in' ? 'Checked In' : registration.status.charAt(0).toUpperCase() + registration.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">{registration.user?.email}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Registered {new Date(registration.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    {registration.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(registration.id)}
                          disabled={processingId === registration.id}
                          className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {processingId === registration.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(registration.id)}
                          disabled={processingId === registration.id}
                          className="px-3 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50"
                        >
                          {processingId === registration.id ? '...' : 'Reject'}
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
                            className="px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700"
                          >
                            📱 Send
                          </button>
                        ) : (
                          <button className="px-3 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-lg cursor-not-allowed" disabled>
                            No phone
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-medium text-sm text-slate-900 mb-3">Responses</h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(registration.responses).map(([key, value]) => {
                      const field = event.formSchema.fields.find(f => f.name === key);
                      const label = field?.label || key;
                      const stringValue = String(value);
                      const isLink = stringValue.includes('drive.google.com') || /^https?:\/\//i.test(stringValue);

                      return (
                        <div key={key} className="bg-slate-50 rounded-lg p-3">
                          <dt className="text-xs text-slate-500 font-medium uppercase">{label}</dt>
                          <dd className="text-slate-900 mt-1">
                            {isLink ? (
                              <a
                                href={stringValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 underline text-sm break-all"
                              >
                                {stringValue.length > 50 ? stringValue.slice(0, 50) + '...' : stringValue}
                              </a>
                            ) : (
                              <span className="text-sm">{stringValue}</span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>

                {/* CSV-driven preview if available */}
                {(() => {
                  const keyCandidates = ['SRN', 'srn', 'srn_number', 'roll', 'Roll', 'registration_number', 'Registration Number'];
                  let regKeyVal = '';
                  for (const k of keyCandidates) {
                    if (k in registration.responses) { regKeyVal = String(registration.responses[k] ?? '').trim(); break; }
                  }
                  if (!regKeyVal) regKeyVal = registration.user?.email ?? '';

                  const csvRow = csvIndex[regKeyVal] || csvIndex[regKeyVal.toUpperCase?.() ?? ''] || csvIndex[regKeyVal.toLowerCase?.() ?? ''];
                  if (!csvRow) return null;

                  const rawLink = csvRow[csvLinkField] ?? csvRow[csvLinkField.trim()] ?? Object.values(csvRow).find(v => String(v).includes('drive.google.com')) ?? '';
                  const previewUrl = rawLink ? getPreviewUrlFromLink(String(rawLink)) : '';

                  return (
                    <div className="pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setPreviewOpen(prev => ({ ...prev, [registration.id]: !prev[registration.id] }))}
                        className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                      >
                        {previewOpen[registration.id] ? 'Hide' : 'Show'} PDF
                      </button>

                      {previewOpen[registration.id] && previewUrl && (
                        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden h-96 md:h-[500px]">
                          <iframe src={previewUrl} className="w-full h-full" title="Document preview" />
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">CSV</p>
            <h2 className="text-lg font-semibold text-slate-900">Rows not on platform</h2>
          </div>
          {(() => {
            // build a set of matched keys from registrations
            const matchedKeys = new Set<string>();
            const keyCandidates = ['SRN', 'srn', 'srn_number', 'roll', 'Roll', 'registration_number', 'Registration Number'];
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

            if (missing.length === 0) return <p className="text-slate-600">All CSV entries matched. ✓</p>;

            return (
              <div className="space-y-2">
                {missing.map((row, idx) => {
                  const keyVal = (row[csvKeyField] ?? row[csvKeyField.trim()] ?? row['SRN'] ?? row['srn'] ?? '') as string;
                  const link = (row[csvLinkField] ?? '') as string;
                  const phone = cleanPhone((row['phone'] ?? row['Phone'] ?? row['mobile'] ?? row['Mobile'] ?? '') as string);
                  return (
                    <div key={idx} className="flex justify-between items-center border border-slate-100 rounded-lg p-3 bg-slate-50">
                      <div>
                        <div className="font-medium text-slate-900">{keyVal || '—'}</div>
                        {link && <div className="text-xs text-slate-600 mt-1 break-all">{link}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {phone ? (
                          <button onClick={() => openWhatsApp(phone, draftMessage)} className="px-3 py-1 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">📱</button>
                        ) : null}
                        {link ? <a href={getPreviewUrlFromLink(link)} target="_blank" rel="noreferrer" className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">PDF</a> : null}
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