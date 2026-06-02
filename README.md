# Tlhiso — Production-Grade Build

Multi-industry business management platform for South African businesses.
Supports B2B, Medical & Health, Property Management, and Consumer Business verticals.

## Stack
React 18 · Vite 5 · React Router v6 · Firebase v10 (Auth, Firestore, Storage, Functions) ·
Tailwind CSS · React Hook Form + Zod · TanStack Query · Recharts · Lucide · Leaflet

## Setup

```bash
npm install
cp .env.example .env.staging      # then fill in values
npm run dev                       # uses .env.staging by default
```

### Environment variables
Two files, one per Firebase project. `authDomain`, `projectId` and
`storageBucket` are pre-filled to match Firebase naming; paste the remaining
values from each project's console (Project settings → General → Your apps):

- `.env.staging`    → tlhiso-staging project
- `.env.production` → tlhiso project

**Never** put SendGrid / BulkSMS / Twilio secrets in these files. Those belong
only in Firebase Functions config:
```bash
firebase functions:secrets:set SENDGRID_API_KEY
```

## Scripts
| script | what it does |
|---|---|
| `npm run dev` | local dev server |
| `npm run build:staging` | build with `.env.staging` |
| `npm run build:production` | build with `.env.production` |
| `npm run deploy:staging` | build + deploy to staging hosting target |
| `npm run deploy:prod` | build + deploy to production hosting target |
| `npm run lint` | ESLint |

## The staging/production auth fix
The login + password-reset breakage on tlhiso.com comes from a build picking up
the wrong project's `authDomain`. This foundation prevents that:

1. **One env flag.** `VITE_APP_ENV` in each `.env.[mode]` file is the only
   switch. `src/services/firebase.js` reads config purely from `import.meta.env`
   — nothing is hardcoded per environment.
2. **Fail-fast validation.** Missing config keys throw in dev. If `authDomain`
   doesn't reference the same project as `projectId`, a console warning fires —
   that mismatch is exactly what sends reset emails to the wrong project.
3. **Mode-locked builds.** `build:production` can only load `.env.production`,
   so a staging value can't leak into a production deploy.

When you set the real production values, make sure
`VITE_FIREBASE_AUTH_DOMAIN=tlhiso.firebaseapp.com` (or your custom auth domain)
and `VITE_FIREBASE_PROJECT_ID=tlhiso` agree. If you use a custom reset-email
action URL, set it in the **production** project's Auth templates, not staging.

## What's built

### Foundation
- Firebase dual-environment config (production/staging) with fail-fast validation
- `AuthContext` — auth user + live Firestore profile subscription
- Route guards: `PrivateRoute` → `ActiveUserRoute` → `IndustryRoute` → `SuperAdminRoute`

### Auth Flows
- 4-step Register: personal details → industry/profession → plan → success
- Login with email/password and Google Sign-In
- Forgot password via Firebase
- Pending activation page (isActive: false until admin approves)

### Landing Page
- Hero, industry cards, features tabs, testimonials, pricing, footer
- Responsive, sage green design system

### Dashboards (all 4 industries + Super Admin)
- Shared `DashboardLayout`: collapsible dark sidebar, topbar, mobile overlay
- **B2B**: clients, invoices (with VAT/line items), campaigns, POPIA, profile
- **Medical**: patients (full SA fields), SOAP consultations with audio recording + AI transcription, POPIA
- **Property**: properties, tenants (with document upload), maintenance log, POPIA
- **Retail**: customers, weekly deals, POPIA, profile
- **Super Admin**: all-users table with activate/deactivate/delete, send message, settings

### Shared Modules
- `DataTable` with sortable columns + CSV export
- `Modal`, `StatCard`, `ProfilePage` (with banking details), `PopiaModule`
- `useCollection` hook for real-time Firestore subscriptions

### Cloud Functions (functions/index.js)
- `sendEmail` — SendGrid
- `sendSMS` — BulkSMS (South African +27 numbers)
- `sendWhatsApp` — Twilio
- `transcribeConsultation` — AssemblyAI
- `onUserCreated` — auto-creates Firestore profile + notifies admin
- `sendActivationEmail` — triggered from super admin activate action

### Deployment
- `firebase.json` with two hosting targets (production + staging)
- `.firebaserc` project mapping
- `firestore.rules` — users can only access their own data; super admin has broad access
- `storage.rules` — per-user file isolation

## Setting up Cloud Function secrets

```bash
firebase functions:secrets:set SENDGRID_API_KEY
firebase functions:secrets:set BULKSMS_TOKEN_ID
firebase functions:secrets:set BULKSMS_TOKEN_SECRET
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_WHATSAPP_NUMBER
firebase functions:secrets:set ASSEMBLYAI_API_KEY
```

## DNS setup
Point `tlhiso.com` A record and `www` CNAME to Firebase Hosting IPs shown in
Firebase Console → Hosting → Custom domain. Do the same for `staging.tlhiso.com`
against the `tlhiso-staging` project.

## Super Admin
Set admin Custom Claim in Firebase Console or via Admin SDK:
```js
admin.auth().setCustomUserClaims(uid, { isAdmin: true })
```
Or simply use the email check (`admin@adobeing.com`) which is already in the security rules.
