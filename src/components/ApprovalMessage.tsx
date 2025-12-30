"use client";

import React from 'react';

interface Props {
  email?: string | null;
  className?: string;
}

import { getApprovalMessage } from '@/lib/approvalMessage';

export default function ApprovalMessage({ email, className }: Props) {
  const html = getApprovalMessage(email ?? undefined);
  return <p className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
