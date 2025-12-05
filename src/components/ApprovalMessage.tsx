"use client";

import React from 'react';

interface Props {
  email?: string | null;
  className?: string;
}

const defaultTemplate =
  "You will receive an email at <strong>{email}</strong> once your application is approved. If selected, submit the payment screenshots when requested. After approval by the organizer, your QR code will appear here and you can show up to the event";

function escapeHtml(unsafe?: string) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function ApprovalMessage({ email, className }: Props) {
  const template = process.env.NEXT_PUBLIC_APPROVAL_MESSAGE || defaultTemplate;
  const html = template.replace('{email}', escapeHtml(email || ''));

  return <p className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
