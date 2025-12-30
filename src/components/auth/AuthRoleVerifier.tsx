"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

export default function AuthRoleVerifier() {
    const { data: session, status } = useSession();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        // Only check when authenticated and not already checked
        if (status !== "authenticated" || !session?.user || checked) return;

        let mounted = true;

        // Capture values synchronously so the async closure doesn't see a possibly-null `session`
        const userId = session.user.id;
        const sessRole = session.user.role;

        async function checkRole() {
            try {
                const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, { credentials: "same-origin" });
                if (!mounted) return;

                if (res.status === 200) {
                    const body = await res.json();
                    const dbRole = body?.user?.role;

                    if (dbRole && sessRole && dbRole !== sessRole) {
                        // Role changed — sign the user out and show message on sign-in page
                        await signOut({ callbackUrl: `/auth/signin?message=${encodeURIComponent("Your role changed. Please sign in again to continue.")}` });
                    }
                }
            } catch (e) {
                // Ignore errors — don't block the user if the check fails
                // Optionally we could log to an analytics backend here
            } finally {
                if (mounted) setChecked(true);
            }
        }

        checkRole();

        return () => {
            mounted = false;
        };
    }, [status, session, checked]);

    return null;
}
