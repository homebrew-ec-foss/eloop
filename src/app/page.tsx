
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();
  
  // Redirect authenticated users to dashboard
  if (session) {
    redirect('/dashboard');
  }
  
  // Redirect non-authenticated users to events page (public access)
  redirect('/dashboard/events');
}
