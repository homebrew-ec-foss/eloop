"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOut() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    
    try {
      // First, call our custom signout endpoint to handle both server and client-side
      const res = await fetch("/api/auth/custom-signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      if (res.ok) {
        console.log("Sign out successful from custom API");
      } else {
        console.error("Custom sign out API call failed:", res.statusText);
        
        // Fall back to standard NextAuth signout as backup
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ redirect: false }),
        });
      }
      
      // Clear all cookies by setting them to expire in the past
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        
        // Set expiration in the past for each cookie
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
      }
      
      // Clean up storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Add a small delay to ensure cookies are cleared before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error("Error during sign out:", error);
    }
    
    // Force a hard refresh to ensure all client state is cleared
    window.location.href = "/?signedout=true";
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign Out</h1>
          <p className="mt-2 text-gray-600">
            Are you sure you want to sign out?
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="w-full py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing out..." : "Sign out"}
          </button>

          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full py-2.5 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}