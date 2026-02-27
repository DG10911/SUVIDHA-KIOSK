# SUVIDHA - Citizen Services Kiosk

## Overview

SUVIDHA is a full-stack citizen services kiosk application designed for touchscreen kiosks in India. It provides a one-stop digital platform for civic services including utility bill payments (electricity, gas, water), complaint registration and tracking, government scheme information, certificate applications, RTI filings, grievance portals, pension tracking, digital document storage (DigiLocker), appointment booking, emergency SOS, and more.

The application is built as a monorepo with a React frontend and Express backend, using PostgreSQL for data persistence. It features multilingual support, face-recognition-based login, QR code authentication, OTP-based login via Twilio, voice interaction capabilities, and accessibility modes (senior citizen mode, high-contrast, large fonts).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; local state via React hooks and localStorage-based stores (`kioskStore.ts`, `userPreferences.ts`)
- **UI Components**: shadcn/ui component library (New York style) built on Radix UI primitives with Tailwind CSS v4
- **Animations**: Framer Motion for page transitions and interactive elements
- **Styling**: Tailwind CSS with CSS variables for theming (supports dark mode, high-contrast mode)
- **Fonts**: Outfit (headings) and Inter (body text) from Google Fonts
- **Internationalization**: Custom translation system in `client/src/lib/translations.ts` supporting English, Hindi, and regional languages
- **Face Recognition**: face-api.js + MediaPipe Tasks Vision for face detection, liveness checks, and face-based login. Multi-sample system stores multiple face descriptors per user (up to 50) across different devices and lighting conditions for robust cross-device matching. Auto-learning adds new samples on successful login. Descriptor normalization ensures lighting invariance.
- **QR Code**: html5-qrcode library for QR code scanning login
- **Voice/Audio**: Custom voice agent with MediaRecorder API for recording, AudioWorklet for playback, SSE streaming for AI responses
- **Service Worker**: PWA support with offline caching (`client/public/sw.js`)
- **Text-to-Speech**: Server-side TTS via `/api/tts` endpoint with client-side PCM16 audio playback

### Backend (server/)
- **Framework**: Express.js with TypeScript, running via tsx
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Defined in `shared/schema.ts` — includes users, face profiles, QR tokens, complaints, documents, notifications, wallet accounts/transactions, appointments, feedback, announcements, emergency logs, government schemes, certificate applications, RTI applications, grievances, pension records, DigiLocker entries, water bills, and more
- **Authentication**: Multiple methods — mobile OTP (via Twilio), QR code tokens, face recognition matching, and basic username/password
- **API Structure**: REST API under `/api/` prefix with routes defined in `server/routes.ts`
- **SMS/OTP**: Twilio integration via Replit Connectors for OTP-based authentication
- **Voice/Audio AI**: Replit AI integrations for voice conversations (`server/replit_integrations/audio/`)
- **Image Generation**: Replit AI integrations for image generation (`server/replit_integrations/image/`)
- **Build**: Custom build script (`script/build.ts`) using esbuild for server bundling and Vite for client bundling; output to `dist/`

### Shared Code (shared/)
- `shared/schema.ts` — All Drizzle ORM table definitions and Zod validation schemas, shared between client and server
- `shared/models/chat.ts` — Conversation and message schemas for the voice chat feature

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Connection**: `pg.Pool` via `DATABASE_URL` environment variable
- **Migrations**: Generated via `drizzle-kit push` (config in `drizzle.config.ts`, output to `migrations/`)
- **In-memory fallback**: `server/storage.ts` has a `MemStorage` class but the main app uses PostgreSQL via Drizzle

### Governance System
- **Multi-role access**: 6 roles - Citizen, Staff, Contractor, Authority, Head, Admin
- **Role-based login**: `/role-login` with role selection and credential auth; demo credentials seeded via `/api/admin/seed-roles`
- **Staff Dashboard** (`/staff-dashboard`): Assigned complaints, status updates, escalation to contractors, SLA tracking
- **Contractor Dashboard** (`/contractor-dashboard`): Work orders, progress tracking, resource management, cost tracking
- **Authority Dashboard** (`/authority-dashboard`): Department-scoped view — each authority (Water, Gas, Electricity, Sanitation, Municipal) sees only their department's complaints, staff, work orders, and stats. Authorities have staff profiles with `department` field for scoping.
- **Head Dashboard** (`/head-dashboard`): District Collector's cross-department command center — overview of all departments, department rankings/comparisons, all staff/contractor performance, work order approvals, AI insights across all departments, clusters & hotspots, public transparency dashboard, staff directory with contact info and messaging. Emerald-themed UI.
- **Admin Dashboard** (`/admin-dashboard`): User management, role assignment, staff/contractor profile creation, audit logs, system stats, analytics, AI configuration, security
- **Backend routes**: `server/governance-routes.ts` — All governance APIs (staff, contractor, authority, head, admin); department scoping via `getAuthorityDepartment()` helper
- **AI routes**: `server/ai-routes.ts` — AI complaint analysis (categorization, duplicate detection, priority scoring, fake detection, voice-to-complaint, insights)
- **Schema additions**: `staffProfiles`, `contractorProfiles`, `workOrders`, `workOrderResources`, `complaintClusters`, `complaintClusterLinks`, `auditLogs`, `aiAnalysis` tables; `role` column added to `users` table
- **Complaint lifecycle**: submitted → in_progress → escalated → work_ordered → completed → approved
- **Demo data**: 6 staff, 4 contractors, 5 authorities (one per department), 1 head (District Collector), 1 admin seeded via API
- **Authority users**: authority1 (Electricity/CSPDCL), authority2 (Gas), authority3 (Water/PHE), authority4 (Sanitation), authority5 (Municipal Engineering)
- **Head user**: head1 (District Collector) — password: head1

### Indian Location Hierarchy System
- **Database tables**: `indianStates` (36 states/UTs), `indianCities` (8,487 cities/towns), `indianWards` (130 wards with GPS coordinates for 12 major cities), `locationStaffAssignments` (staff/authority/head/admin per ward/city)
- **Seeded cities**: 8,487 cities across all Indian states — 12 major cities with wards (Raipur 20 wards, Delhi/Mumbai/Bangalore/Hyderabad/Chennai/Kolkata/Pune/Ahmedabad/Jaipur/Lucknow/Bhopal 10 wards each), plus ~8,475 additional cities/towns with GPS coordinates generated from district data
- **City data generator**: `server/generate-cities.ts` — generates `server/data/indian-cities-8000.json` with cities distributed across all states proportional to population (UP ~1020, Maharashtra ~650, Tamil Nadu ~620, etc.)
- **City-specific departments**: Each major city has local department names (e.g., BEST for Mumbai electricity, BESCOM for Bangalore, BSES for Delhi)
- **Seed script**: `server/seed-locations.ts` — auto-runs on startup, creates all states, 12 major cities with wards + staff, then bulk-inserts ~8,475 additional cities from JSON data. Skips if already seeded (checks city count > 1000)
- **Location APIs**: `/api/locations/states`, `/api/locations/cities?stateId=`, `/api/locations/wards?cityId=`, `/api/locations/resolve?lat=&lng=&city=&state=&ward=`

### Auto-Routing System
- **GPS-based ward detection**: When filing a complaint, citizen's GPS location is reverse-geocoded (Google Maps Geocoder) to extract city/state/ward, then matched against the `indianWards` database
- **Complaint auto-routing**: Uses `locationStaffAssignments` table first (ward → city → state level), then falls back to legacy `staffProfiles` department + ward text matching
- **Ward-based assignment**: Complaints include `wardId`, `cityId`, `stateId` (integer IDs) plus legacy `ward` text field; staff with matching ward assignment get priority
- **Manual override**: Users can manually select state/city/ward from dropdowns if GPS detection fails
- **Schema additions**: `wardId`, `cityId`, `stateId` fields added to `complaints` table; `email`, `address`, `facePhoto` fields added to `users` table

### Admin Staff Directory
- **Detailed profile cards**: Admin dashboard has a "Staff Directory" tab showing all staff, contractors, and authority users with face photos, contact info (phone, email), Aadhaar (masked), address, joined date, department/company, designation/specialization, employee/contractor IDs, ward assignments
- **Quick message**: Inline messaging form for admin to send quick messages to any staff/contractor
- **Meeting scheduling**: Inline form with date/time/subject for scheduling meetings with staff/authority
- **API endpoint**: `GET /api/admin/all-profiles` returns all staff and contractor profiles

### Accessibility Mode (Blind Users)
- **Floating accessibility panel**: Blue accessibility button at bottom-left on all pages (`client/src/components/AccessibilityMode.tsx`)
- **Screen reader**: Reads focused elements aloud using Web Speech API
- **Voice navigation**: Voice commands for hands-free navigation ("go home", "file complaint", "emergency", "help", etc.) using Web Speech Recognition API
- **High contrast mode**: Increased contrast and bold borders for low vision users
- **Text size control**: Adjustable font size (12-28px) with zoom in/out buttons
- **Audio feedback**: TTS announcements for all actions and navigation
- **Keyboard shortcuts**: Alt+A (panel), Alt+H (home), Alt+C (complaints), Alt+S (services), Alt+V (voice nav), Tab (navigate)

### Key Design Decisions
1. **Kiosk-first UI**: Large touch targets, step-by-step guided flows, progress indicators, icon-heavy design optimized for public kiosks rather than desktop/mobile browsers
2. **Multi-auth approach**: Supports face login, QR scan, mobile OTP, and traditional login to accommodate diverse user capabilities (illiterate users, elderly, tech-savvy citizens)
3. **Offline-capable**: Service worker caches static assets and API responses for resilience in areas with unreliable connectivity
4. **Monorepo structure**: Client, server, and shared code in a single repo with path aliases (`@/` for client, `@shared/` for shared code)
5. **Client-side local storage**: `kioskStore.ts` maintains a local cache of requests, documents, and notifications in localStorage, synced with the API
6. **Role-based governance**: Dark-themed admin dashboards separate from the citizen kiosk UI; localStorage-based auth for role users
7. **Inclusive accessibility**: Floating accessibility panel available on all pages for blind/low-vision users with voice commands, screen reader, and high contrast support

## External Dependencies

### Required Services
- **PostgreSQL Database**: Primary data store, connected via `DATABASE_URL` environment variable
- **Twilio**: SMS/OTP authentication via Replit Connectors (requires Twilio connector configured in Replit)

### Optional/Integrated Services
- **Replit AI (Audio)**: Voice conversation streaming with SSE-based audio responses
- **Replit AI (Image)**: Image generation capabilities
- **MediaPipe**: Client-side face landmark detection for liveness checks (loaded from CDN)
- **face-api.js**: Client-side face detection and recognition (models stored in `client/public/models/`)
- **Google Fonts CDN**: Outfit and Inter font families

### Key NPM Dependencies
- `drizzle-orm` / `drizzle-kit` — Database ORM and migration tooling
- `express` / `express-session` — HTTP server and session management
- `connect-pg-simple` — PostgreSQL session store
- `twilio` — SMS/voice API client
- `bcryptjs` — Password hashing
- `crypto-js` — Encryption utilities (QR token payload encryption)
- `face-api.js` — Browser-based face recognition
- `@mediapipe/tasks-vision` — Face landmark detection
- `html5-qrcode` — QR code scanning
- `framer-motion` — UI animations
- `wouter` — Client-side routing
- `@tanstack/react-query` — Server state management
- `zod` / `drizzle-zod` — Schema validation
- `nanoid` — ID generation