import { UserRole } from "@/types";

// Add missing type declarations for next-auth/jwt
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    organizerId?: string;
    isApproved: boolean;
  }
}