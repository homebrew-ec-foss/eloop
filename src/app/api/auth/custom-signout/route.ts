import { signOut } from "@/lib/auth";

export async function POST() {
  // First use NextAuth's signOut function
  await signOut({ redirect: false });
  
  // Set up headers with cookies to be cleared
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');
  
  // Add Set-Cookie headers to expire auth cookies
  const cookiesToClear = [
    'next-auth.session-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    'next-auth.csrf-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    'next-auth.callback-url=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    '__Secure-next-auth.session-token=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax',
    '__Host-next-auth.csrf-token=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax',
  ];
  
  cookiesToClear.forEach(cookie => {
    headers.append('Set-Cookie', cookie);
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers
  });
}