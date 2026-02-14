"use client";

import React, { useState, useRef } from 'react';

export default function WhatsAppMassSender() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvUrl, setCsvUrl] = useState('');
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [filterPending, setFilterPending] = useState(true);
  const defaultPaymentConfirmationMessage = process.env.NEXT_PUBLIC_PAYMENT_CONFIRMATION_MESSAGE ?? `We invite you to our flagship hackathon, HackNight 7.0!\nPlease go ahead and confirm your attendance by paying on PESU Academy, and attaching your receipt in the form attached below.\n\nPayment confirmation form: https://forms.gle/VmHFWiZDxfmUc3D46\n\nThe deadline for payments is 15th October. This is a hard deadline, and you will not be able to attend if you miss this window. \n\nThank you!\nRegards,\nTeam ACM PESUECC`;
  const [message, setMessage] = useState(defaultPaymentConfirmationMessage);

  function cleanPhone(num?: string) {
    if (!num) return '';
    let cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  }

  async function fetchCSV(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Dynamically import papaparse to avoid SSR/type issues if not installed
      // Simple CSV parser (handles quoted fields and commas inside quotes)
      const parseCSV = (src: string) => {
        const lines = src.split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) return [] as Array<Record<string, string>>;
        const parseLine = (line: string) => {
          const res: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              res.push(cur);
              cur = '';
            } else {
              cur += ch;
            }
          }
          res.push(cur);
          return res.map(s => s.trim());
        };

        const header = parseLine(lines[0]);
        const data = lines.slice(1).map(l => {
          const parts = parseLine(l);
          const obj: Record<string, string> = {};
          header.forEach((h, i) => { obj[h] = parts[i] ?? ''; });
          return obj;
        });
        return data;
      };

      const parsed = parseCSV(text);
      setRows(parsed);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : String(err);
      alert(`Failed to fetch CSV: ${msg}`);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = ((): Array<Record<string, string>> => {
        // reuse parseCSV defined above by duplicating logic
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) return [];
        const parseLine = (line: string) => {
          const res: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              res.push(cur);
              cur = '';
            } else {
              cur += ch;
            }
          }
          res.push(cur);
          return res.map(s => s.trim());
        };
        const header = parseLine(lines[0]);
        const data = lines.slice(1).map(l => {
          const parts = parseLine(l);
          const obj: Record<string, string> = {};
          header.forEach((h, i) => { obj[h] = parts[i] ?? ''; });
          return obj;
        });
        return data;
      })();
      setRows(parsed);
    };
    reader.readAsText(f);
  }

  const filtered = rows.filter(r => {
    if (!filterPending) return true;
    const status = ((r['Status'] || r['status'] || '') as string).toLowerCase();
    return status === 'pending';
  });

  const headers = filtered.length ? Object.keys(filtered[0]) : [];

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">WhatsApp Mass Sender</h3>

      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-7">
          <label className="block text-sm font-medium mb-1">CSV Endpoint URL</label>
          <input value={csvUrl} onChange={e => setCsvUrl(e.target.value)} className="w-full border rounded p-2" placeholder="https://example.com/data.csv" />
        </div>
        <div className="col-span-2 flex items-end">
          <button onClick={() => { if (!csvUrl) { alert('Enter CSV URL'); return; } fetchCSV(csvUrl); }} className="px-4 py-2 bg-blue-600 text-white rounded">Fetch CSV</button>
        </div>
        <div className="col-span-3 flex items-end gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filterPending} onChange={e => setFilterPending(e.target.checked)} className="w-4 h-4" />
            <span className="font-medium">Show Pending Only</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-6">
          <label className="block text-sm font-medium mb-1">Upload CSV File</label>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChange} className="w-full border rounded p-2" />
        </div>
        <div className="col-span-6">
          <label className="block text-sm font-medium mb-1">Draft Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full border rounded p-2" />
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="p-2">Action</th>
              <th className="p-2">Phone</th>
              {headers.map(h => <th key={h} className="p-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={headers.length + 2} className="p-4 text-center text-gray-500">No records</td></tr>
            )}
            {filtered.map((r, idx) => {
              const phoneRaw = r['Phone Number'] || r['phone'] || r['phone_number'] || r['Phone'] || r['Mobile'] || r['mobile'] || r['PHONE'] || '';
              const phone = cleanPhone(phoneRaw);
              const encoded = encodeURIComponent(message);
              const wa = phone ? `https://wa.me/${phone}?text=${encoded}` : '';
              return (
                <tr key={idx} className="border-t">
                  <td className="p-2">{phone ? <a href={wa} target="_blank" rel="noreferrer" className="inline-block bg-green-500 text-white px-3 py-1 rounded">📱 Send</a> : <span className="text-gray-400">No Phone</span>}</td>
                  <td className="p-2">{phone}</td>
                  {headers.map(h => <td key={h} className="p-2">{String(r[h] ?? '')}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
