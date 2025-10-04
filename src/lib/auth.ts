import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail, createUser } from "@/lib/db/user";
import { UserRole } from "@/types";

// Validate environment variables are set properly
const validateEnv = () => {
  const requiredEnvVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN'
  ];
  
  const missingVars = requiredEnvVars.filter(
    envVar => !process.env[envVar]
  );
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  } else {
  }
}

validateEnv();

// Define the shape of the session user object
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      organizerId?: string;
    };
  }
}

// The JWT token shape is defined in /src/types/next-auth.d.ts

export const authConfig: NextAuthConfig = {
  providers: [
    // Keep Google provider for when we set up proper OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      // Add profile handler to prevent configuration errors
      profile(profile) {
        return {
          id: profile.sub || profile.id || crypto.randomUUID(),
          name: profile.name || profile.given_name || "Unknown User",
          email: profile.email || "unknown@example.com",
          image: profile.picture || null,
          role: "participant"
        };
      }
    }),
  ],
  // Disable debug to reduce noise
  debug: false,
  callbacks: {
    async jwt({ token, user }) {
      // First time sign in
      if (user) {
        try {
          console.log("Fetching user from database:", user.email);
          let dbUser = await getUserByEmail(user.email!);
          
          // If it's a new user, check if email matches ADMIN_EMAIL in env
          if (!dbUser) {
            const userId = crypto.randomUUID();
            console.log("Creating new user with ID:", userId);
            
            // Check if this user's email matches the admin email in env
            const adminEmail = process.env.ADMIN_EMAIL;
            const isAdmin = adminEmail && user.email?.toLowerCase() === adminEmail.toLowerCase();
            const role = isAdmin ? 'admin' : 'applicant'; // New users start as applicants
            console.log(`Creating user with role: ${role} (Admin email match: ${isAdmin})`);
            
            try {
              console.log(`Attempting to create user: ${JSON.stringify({
                id: userId,
                email: user.email!,
                name: user.name!,
                role: role,
              })}`);
              
              dbUser = await createUser({
                id: userId,
                email: user.email!,
                name: user.name!,
                role: role,
              });
              
              console.log(`User created successfully: ${JSON.stringify(dbUser)}`);
            } catch (createError) {
              console.error(`Error creating user: ${createError instanceof Error ? createError.message : String(createError)}`);
              throw createError; // Re-throw to be caught by outer catch
            }
          }
          
          console.log("User found/created:", dbUser);
          return {
            ...token,
            id: dbUser.id,
            role: dbUser.role,
            organizerId: dbUser.organizerId,
          };
        } catch (error) {
          console.error("Error in JWT callback:", error);
          // Return basic token data to prevent complete auth failure
          return {
            ...token,
            id: crypto.randomUUID(),
            role: 'participant'
          };
        }
      }
      
      // On subsequent calls, return the token
      return token;
    },
    
    async session({ session, token }) {
      // Add user role and id to the session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        if (token.organizerId) {
          session.user.organizerId = token.organizerId as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};


// Role-based authorization utility
export function canAccessRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'admin': 4,
    'organizer': 3,
    'volunteer': 2,
    'participant': 1,
    'applicant': 0, // Applicants have lowest access
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);