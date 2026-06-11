# Tlhiso — Claude Code Instructions

## RULE 1 — Read the app record before every code change

Before making **any** edit, write, or code change:

1. Read `TLHISO_APP_RECORD.md` in the project root.
2. Confirm your understanding of what's already built before touching anything.
3. **Only change exactly what the user asks for.** Do not refactor, rename, or improve anything beyond the stated request.

## RULE 2 — Scope discipline

- Do not add unrequested features, clean up unrelated code, or make "while I'm here" edits.
- If you notice something worth fixing that was not asked for, mention it in words — do not fix it silently.

## RULE 3 — Deployment awareness

- Production project: `tlhiso` — live at https://tlhiso.com
- Staging project: `tlhiso-staging`
- After any change that needs to go live, remind the user to run `npm run deploy:prod`.
- Never auto-deploy without being asked.

## RULE 4 — Secrets stay in Secret Manager

- Never write API keys (SendGrid, BulkSMS, Twilio, AssemblyAI) into any source file or `.env`.
- Those live only in Google Secret Manager via `firebase functions:secrets:set`.

---

## Architecture at a Glance

**React 18 + Vite 5 + Firebase v10 + Tailwind CSS 3**

- Routing: React Router v6 with nested `<Routes>` inside each dashboard component.
- Auth: `src/contexts/AuthContext.jsx` — provides `{ user, profile, loading }`. `profile` is the live Firestore `/users/{uid}` doc.
- Real-time data: `src/hooks/useCollection.js` — wraps `onSnapshot` for any Firestore subcollection.
- Services: `src/services/firebase.js` (dual-env init), `src/services/messaging.js` (unified sendMessage wrapper).
- Route guards: `src/routes/guards.jsx` — `PrivateRoute`, `ActiveUserRoute`, `IndustryRoute`, `SuperAdminRoute`.

---

## Key Files

| File | Purpose |
|---|---|
| `src/utils/industries.js` | Single source of truth: `INDUSTRIES`, `PLANS`, `SUPER_ADMIN_EMAIL`, `dashboardPathFor()` |
| `src/utils/authErrors.js` | Maps Firebase auth error codes → user-friendly strings |
| `src/services/firebase.js` | Dual-env Firebase init with fail-fast env var validation |
| `src/services/messaging.js` | `sendMessage({ type, to, ... })` → calls the matching Cloud Function |
| `src/components/shared/DashboardLayout.jsx` | Sidebar + topbar shell used by all 4 industry dashboards |
| `src/components/shared/DataTable.jsx` | Reusable table with search/sort/pagination |
| `src/components/shared/Modal.jsx` | Generic modal wrapper |
| `src/components/shared/StatCard.jsx` | KPI card used on dashboard overview pages |
| `src/components/shared/ProfilePage.jsx` | Shared profile editor (photo, business info, banking details) |
| `src/components/shared/PopiaModule.jsx` | POPIA compliance tabs (Consent, Requests, Notices, Breaches) |
| `src/components/shared/Placeholder.jsx` | "Section being built" stub used for incomplete nav items |
| `functions/index.js` | All 6 Cloud Functions (2nd gen, Node 20, us-central1) |

---

## Dashboard Sections

Each dashboard is a single file with internal `<Routes>` and sub-components. Pattern:
- Overview tab → `StatCard` grid + recent `DataTable`
- Each nav item → its own sub-route and section component inside the same file
- Incomplete sections render `<Placeholder />` or a `<div>` stub

### Medical (`/medical/*`)
Patients · Consultations (with audio recording + AssemblyAI transcription) · Medical Reports (PDF generation via `@react-pdf/renderer`) · Referrals · Appointments · Messages · Campaigns · Surveys · Practitioners · Profile · POPIA · Settings

### B2B (`/b2b/*`)
Dashboard · Clients · Invoices · Statements · Quotations · Projects · Service List · Appointments · Messages · Campaigns · Surveys · Marketing Opt-In · Profile · POPIA · Settings

### Property (`/property/*`)
Dashboard · Properties · Tenants · Statements · Invoices · Maintenance · Owners · Appointments · Messages · Campaigns · Documents · Profile · POPIA · Settings

### Retail (`/retail/*`)
Dashboard · Customers · Appointments · Messages · Campaigns · Weekly Deals · Surveys · Opt-In · Profile · POPIA · Settings

---

## Cloud Functions

All callable via `httpsCallable(functions, 'functionName')` or the `sendMessage()` wrapper.

| Function | Secrets used |
|---|---|
| `sendEmail` | `SENDGRID_API_KEY` |
| `sendSMS` | `BULKSMS_TOKEN_ID`, `BULKSMS_TOKEN_SECRET` |
| `sendWhatsApp` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` |
| `transcribeConsultation` | `ASSEMBLYAI_API_KEY` (⬜ not yet set in Secret Manager) |
| `sendActivationEmail` | `SENDGRID_API_KEY` |
| `notifyOnUserCreated` | `SENDGRID_API_KEY` (Firestore `onDocumentCreated` trigger) |

---

## Firestore Subcollections per User

```
/users/{uid}/customers      ← B2B clients / Retail customers
/users/{uid}/patients
/users/{uid}/tenants
/users/{uid}/properties
/users/{uid}/invoices
/users/{uid}/campaigns
/users/{uid}/consultations  ← includes audioUrl, transcript
/users/{uid}/appointments
/users/{uid}/messages       ← sent message log
/users/{uid}/deals          ← Retail weekly deals
/users/{uid}/maintenance
/users/{uid}/popia_consents
/users/{uid}/popia_requests
/users/{uid}/popia_breaches
```

---

## SA-Specific Rules (do not break these)

- Phone numbers: always stored/sent as `+27XXXXXXXXX`. Strip leading `0`, prepend `+27`.
- RSA ID: 13-digit validation in patient forms.
- Currency: ZAR displayed with `toLocaleString('en-ZA')`.
- VAT: 15% on invoice totals.
- POPIA — not GDPR. Every dashboard has the `<PopiaModule />` tab.
- SMS provider is BulkSMS (SA gateway), not Twilio SMS for local numbers.

---

## Deployment Commands

```bash
npm run dev                              # local dev
npm run deploy:staging                   # staging
npm run deploy:prod                      # production (hosting only)
firebase deploy --only functions         # functions only
firebase deploy --only firestore:rules   # rules only
firebase deploy --only storage           # storage rules only
firebase deploy                          # everything
```
