# [eloop](https://hsp-ec.xyz/eloop) — An Event Management Platform

Eventloop (eloop) is a serverless event management app built with Next.js and Turso. It supports hierarchical roles, dynamic registration forms, and QR-based check-ins at hackathons!

> This is a project maintained by [HSP](https://hsp-ec.xyz)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpolarhive%2Feloop-serverless-spin&env=QR_SECRET,GOOGLE_CLIENT_SECRET,TURSO_AUTH_TOKEN,NEXTAUTH_SECRET,ADMIN_EMAIL,TURSO_DATABASE_URL,GOOGLE_CLIENT_ID,NEXTAUTH_URL)


<details>
<summary>Documentation</summary>

## On clicking Deploy to Vercel

The project reads configuration from environment variables. See the shipped `.env.example` for placeholders. The most important variables are:

- `ADMIN_EMAIL` — the email that will be granted the initial Admin role on first sign-in
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (server-side)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `NEXTAUTH_URL` — canonical site URL (e.g. `https://your-site.vercel.app`). This value is used for OAuth redirect URIs and for composing absolute URLs (Open Graph images, etc.)
- `NEXTAUTH_SECRET` — secret for NextAuth session encryption
- `QR_SECRET` — secret used to sign QR payloads
- `TURSO_DATABASE_URL` — your Turso/libSQL connection URL (libsql://...)
- `TURSO_AUTH_TOKEN` — Turso service token used to access the database
- `POSTHOG_KEY=phc_xxx` Uses PostHog for instrumentation

## Google OAuth Client Setup

To get your Google oauth key, follow these steps:

1. **Open [Google Console](https://console.cloud.google.com).**

2. **Access Google Auth Platform**  
   Click on `View all products` at the bottom of the page.  
   Locate and select **Google Auth Platform**.

3. **Create a New OAuth Client**  
   - Navigate to the **Clients** tab.
   - Click **Create Client**.
   - Set `Application Type` to **Web Application**.

4. **Configure URIs**  
   - **Authorised JavaScript origins**:  
     Add your frontend URL (e.g., `https://your-frontend.vercel.app`).
   - **Authorised redirect URIs**:  
     Add your backend callback URL (e.g., `https://your-frontend.vercel.app/api/auth/callback/google`).

5. **Finish Setup**  
   - Click **Create** to generate your client credentials.
   - Copy the `Client ID` and `Client Secret` for use in your environment variables.

> **Tip:** If deploying on Vercel, use your Vercel domain for both origins and redirect URIs.

## Database Setup

If you don't already have a Turso database, follow these steps to create one and obtain the values used in `.env.local`:

1. Create an account and open the Turso dashboard (or install the Turso CLI). Turso's docs are at https://turso.tech.
2. Create a new database (give it a short name, e.g. `eloop-events`). You can do this from the dashboard UI or with the Turso CLI.
3. Grab the LibSQL connection string (it starts with `libsql://`) from the database's "Connect" or "Connection" settings in the dashboard. Copy that value into your `.env.local` as `TURSO_DATABASE_URL`.
4. Create a service token (sometimes called a "service key" or "auth token") in the Turso dashboard — this token is used by the server to authenticate to the DB. Copy it to `.env.local` as `TURSO_AUTH_TOKEN`.
5. With `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set in `.env.local`, run the project's DB initializer to create the required tables:

- If you prefer the CLI, the Turso docs show how to login and create databases and tokens (the dashboard exposes the same connection string and token values).
- Pick a region/branch name as you prefer; the LibSQL URL will encode the connection target.
- After initialization you should be able to visit the app and sign in; the first login matching `ADMIN_EMAIL` will be promoted to admin automatically.

The application automatically checks for the database tables on startup and initializes them if they don't exist. The user whose email matches the `ADMIN_EMAIL` environment variable will automatically be assigned the admin role when they first sign in. All other new users will be assigned the "applicant" role by default and must be approved by an admin to become participants.

> **Note:** (eloop-turso) is based on the concept and architecture of the original [eventloop](https://github.com/homebrew-ec-foss/eventloop) backend system at HSP. Reimagined as a modern Next.js frontend with serverless capabilities.

Read more: https://homebrew.hsp-ec.xyz/posts/tilde-4.0-eventloop

## Features

- **Role-Based Access Control**: Admin, Organizer, Volunteer, Participant, and Applicant roles with hierarchical permissions
- **Dynamic Form Builder**: Drag-and-drop interface for creating custom registration forms
- **QR Code Integration**: Secure QR codes for event check-ins with OAuth authentication
- **Serverless Architecture**: Built with Next.js and Turso database for serverless operation
- **Real-Time Analytics**: Track registrations and attendance for events

## Tech Stack

- **Frontend**: Next.js with TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Database**: Turso (SQLite-based serverless database)
- **Authentication**: NextAuth.js with OAuth providers
- **Form Building**: React DnD Kit for drag-and-drop interface
- **QR Code**: QR code generation and scanning for event check-ins


## Project Structure

- `src/app/` — Next.js app directory (pages, API routes, layouts)
- `src/components/` — Reusable UI components
- `src/lib/` — Database, authentication, and utility logic
- `src/types/` — TypeScript types

## Credits & History

### Original Concept
This project is based on the [eventloop](https://github.com/homebrew-ec-foss/eventloop) backend system developed by [homebrew-ec-foss](https://github.com/homebrew-ec-foss). The original eventloop was a Go-based backend service designed for event management with QR code check-in capabilities.

### Project Evolution
- **eventloop (Original)**: Go-based backend with SQLite database, QR code generation, and email notifications
- **eloop-turso (my fork?)**: A Next.js reimplementation with serverless design, Tursodb integration, and enhanced UI/UX

### Key Features Inherited
- Hierarchical role-based access control (Admin → Organizer → Volunteer → Participant)
- QR code-based participant check-in system
- Dynamic event registration with custom forms
- Secure authentication and authorization
- Fork+Deploy <2mins


### Acknowledgments
- Thanks to the original eventloop contributors

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

AGPL

## User Roles

1. **Admin**
   - Can set up organizer accounts
   - Has access to all organizer, volunteer, and participant capabilities
   - One-time setup triggered via a QR code secret

2. **Organizer**
   - Can configure registration forms through a drag-and-drop interface
   - Can view event analytics
   - Can assign volunteers
   - Has access to volunteer and participant capabilities

3. **Volunteer**
   - Uses a QR scanner to check in participants at events
   - Cannot configure forms or view analytics

4. **Participant**
   - Registers for events through OAuth
   - Receives a QR code for check-in
   - Can be scanned by volunteers at the event

5. **Applicant**
   - Default role for new users upon registration
   - Limited access until approved by an admin
   - Must be approved to become a participant and access event registration

</details>
