import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(req: Request) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const role = token?.role as string | undefined;
    if (!role || !(role === 'admin' || role === 'organizer')) {
      return new NextResponse(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const csvMailerLink = process.env.CSV_MAILER_LINK ?? process.env.NEXT_PUBLIC_CSV_MAILER_LINK ?? '';
    return NextResponse.json({ csvMailerLink });
  } catch {
    return new NextResponse(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}
