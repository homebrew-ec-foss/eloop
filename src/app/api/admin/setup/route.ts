import { NextResponse } from 'next/server';

// Redirect API setup to users API
export async function GET() {
  return NextResponse.redirect(new URL('/api/admin/users', process.env.NEXTAUTH_URL));
}

export async function POST() {
  return NextResponse.redirect(new URL('/api/admin/users', process.env.NEXTAUTH_URL));
}
