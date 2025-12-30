"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

type Command = {
    id: string;
    title: string;
    subtitle?: string;
    action?: () => void;
    href?: string;
    show?: boolean;
};

export default function CommandPalette() {
    const { data: session } = useSession();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const baseCommands: Command[] = [
        { id: 'dashboard', title: 'Go to Dashboard', subtitle: 'Overview and quick stats', href: '/dashboard' },
        { id: 'events', title: 'Browse events', subtitle: 'See all events', href: '/dashboard/events' },
        { id: 'create-event', title: 'Create event', subtitle: 'Make a new event', href: '/dashboard/events/create', show: session?.user?.role === 'organizer' },
        { id: 'users', title: 'User management', subtitle: 'Manage Volunteers & Mentors', href: '/dashboard/users', show: session?.user?.role === 'organizer' || session?.user?.role === 'admin' },

    ];

    const commands = baseCommands.filter(c => c.show !== false);
    const filtered = commands.filter(c => (c.title + ' ' + (c.subtitle || '')).toLowerCase().includes(query.trim().toLowerCase()));

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }

            if (e.key === 'Escape') setOpen(false);
        }

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 0);
            setIndex(0);
            setQuery('');
        }
    }, [open]);

    function run(c: Command) {
        setOpen(false);
        if (c.action) {
            c.action();
            return;
        }
        if (c.href) router.push(c.href);
    }

    // keyboard nav inside palette
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex(i => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[index]) run(filtered[index]);
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, filtered, index]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-24">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-lg ring-1 ring-black/10">
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
                            placeholder="Type a command or search (Press Esc to close)"
                            className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            aria-label="Command palette"
                        />
                        <div className="text-sm text-slate-500">Cmd/Ctrl+K</div>
                    </div>
                </div>
                <div className="max-h-64 overflow-auto border-t border-slate-100">
                    {filtered.length === 0 && (
                        <div className="p-4 text-sm text-slate-500">No commands match.</div>
                    )}
                    {filtered.map((c, i) => (
                        <button
                            key={c.id}
                            onClick={() => run(c)}
                            className={`w-full text-left p-3 hover:bg-indigo-50 ${i === index ? 'bg-indigo-50' : ''}`}
                        >
                            <div className="font-medium text-slate-900">{c.title}</div>
                            {c.subtitle && <div className="text-xs text-slate-500 mt-1">{c.subtitle}</div>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
