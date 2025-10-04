import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const session = await auth();
  const isAuthPath = request.nextUrl.pathname.startsWith('/auth');
  const isSignoutPath = request.nextUrl.pathname === '/auth/signout';
  const path = request.nextUrl.pathname;
  
  console.log('Middleware check:', { 
    path: path,
    hasSession: !!session,
    userEmail: session?.user?.email,
    userRole: session?.user?.role
  });
  
  // If not authenticated and trying to access protected routes, redirect to login
  if (!session?.user) {
    // Allow public access to events pages and registration
    if (path.startsWith('/dashboard/events') || path.startsWith('/register/')) {
      return NextResponse.next();
    }
    
    // All other dashboard routes require authentication
    if (path.startsWith('/dashboard')) {
      console.log('Redirecting to signin: No authenticated user');
      return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent(request.url)}`, request.url));
    }
  } else {
    // User is authenticated
    const userRole = session.user.role || 'applicant';
    
    // Applicants can browse events and register, but cannot access their registrations yet
    if (userRole === 'applicant') {
      // Applicants can access: /dashboard, /dashboard/events, /register
      const allowedPaths = ['/dashboard', '/dashboard/events'];
      const isAllowedPath = allowedPaths.some(p => path === p || (p === '/dashboard/events' && path.startsWith(p))) || path.startsWith('/register/');
      
      if (!isAllowedPath) {
        console.log('Applicant trying to access restricted area:', path);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    
    // Role-based access control for specific dashboard routes
    // Admin-only routes (users and analytics)
    if ((path.startsWith('/dashboard/users') || 
         path.startsWith('/dashboard/analytics')) && 
        userRole !== 'admin') {
      console.log('Unauthorized admin-only access attempt:', userRole);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Organizer-only routes (admins CANNOT create events or manage volunteers)
    if ((path.startsWith('/dashboard/events/create') || 
         path.startsWith('/dashboard/volunteers')) &&
        userRole !== 'organizer') {
      console.log('Unauthorized organizer-only access attempt:', userRole);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Volunteer+ routes (check-in) - organizers and volunteers only
    if (path.startsWith('/dashboard/check-in') && 
        userRole !== 'organizer' && 
        userRole !== 'volunteer') {
      console.log('Unauthorized volunteer access attempt:', userRole);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // If already logged in and trying to access auth pages, redirect to dashboard
    // EXCEPT for the signout page - we always allow access to that
    if (isAuthPath && !isSignoutPath) {
      console.log('Redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  
  return NextResponse.next();
}

// Match auth and dashboard routes
export const config = {
  matcher: [
    '/auth/:path*', 
    '/dashboard/:path*',
    '/register/:path*',
  ],
  unstable_allowDynamic: [
    // Allow dynamic imports
    '**/node_modules/jose/**',
  ],
};