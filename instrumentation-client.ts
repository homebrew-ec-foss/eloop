import posthog from "posthog-js"

const POSTHOG_KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY as string) || process.env.POSTHOG_KEY
const POSTHOG_UI_HOST = (process.env.NEXT_PUBLIC_POSTHOG_UI_HOST as string) || process.env.POSTHOG_UI_HOST || "https://eu.posthog.com"

if (typeof window !== "undefined") {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: "/blob",
      ui_host: POSTHOG_UI_HOST,
      defaults: '2025-05-24',
      person_profiles: 'always',
      capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
      debug: process.env.NODE_ENV === "development",
    })
    // Helpful debug to confirm initialization in the browser console
    if (process.env.NODE_ENV === "development") {
      console.debug("PostHog initialized", { POSTHOG_KEY: POSTHOG_KEY ? "<present>" : "<missing>", POSTHOG_UI_HOST })
    }
  } else {
    if (process.env.NODE_ENV === "development") {
      console.debug("PostHog not initialized: POSTHOG key missing on client")
    }
  }
}