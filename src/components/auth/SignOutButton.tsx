'use client';

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className = '' }: SignOutButtonProps) {

  const handleSignOut = async () => {
    try {
      // Call the custom signout endpoint
      const res = await fetch("/api/auth/custom-signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      if (!res.ok) {
        // Fall back to standard NextAuth signout as backup
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ redirect: false }),
        });
      }
      
      // Clear cookies
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
      }
      
      // Clear storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to home page
      window.location.href = "/?signedout=true";
    } catch (error) {
      console.error("Error during sign out:", error);
      // Force redirect on error
      window.location.href = "/";
    }
  };

  return (
    <button 
      onClick={handleSignOut}
      className={className}
    >
      Sign Out
    </button>
  );
}