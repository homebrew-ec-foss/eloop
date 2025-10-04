# eloop-turso - Serverless Event Management System

An event management system that integrates with Turso DBaaS storage, supporting hierarchical roles and dynamic form generation.

> **Note**: This project (eloop) is based on the concept and architecture of the original [eventloop](https://github.com/homebrew-ec-foss/eventloop) backend system, reimagined as a modern Next.js frontend with serverless-capabilities.

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

## Getting Started

1. **Install dependencies:**
   ```bash
   npm i
   ```
2. **Set up environment variables:**
   - Copy `.env.example` to `.env.local` and fill in your secrets (OAuth, Turso, etc).
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000)

## Database Setup

The application automatically checks for the database tables on startup and initializes them if they don't exist. The user whose email matches the `ADMIN_EMAIL` environment variable will automatically be assigned the admin role when they first sign in. All other new users will be assigned the "applicant" role by default and must be approved by an admin to become participants.

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