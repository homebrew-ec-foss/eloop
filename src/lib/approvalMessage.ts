const defaultTemplate =
    "We will reach out at: <strong>{email}</strong> if your application is approved.";

function escapeHtml(unsafe?: string) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getApprovalMessage(email?: string) {
    const template = process.env.NEXT_PUBLIC_APPROVAL_MESSAGE || defaultTemplate;
    return template.replace('{email}', escapeHtml(email || ''));
}
