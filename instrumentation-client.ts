import posthog from "posthog-js"

posthog.init(process.env.POSTHOG_KEY!, {
  api_host: "/blob",
  ui_host: process.env.POSTHOG_UI_HOST || "https://eu.posthog.com",
  defaults: '2025-05-24',
  person_profiles: 'always',
  capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
  debug: process.env.NODE_ENV === "development",
})
