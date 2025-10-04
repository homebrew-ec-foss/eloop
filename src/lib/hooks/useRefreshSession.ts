'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

export function useRefreshSession() {
  const { data: session, update } = useSession();
  
  const refreshSession = useCallback(async () => {
    try {
      if (session) {
        await update({
          ...session
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
  }, [session, update]);
  
  return { refreshSession };
}
