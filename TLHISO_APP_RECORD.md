# Tlhiso — App Record

> Complete reference for the Tlhiso platform: architecture, credentials, deployment history, known issues, and operational runbooks.

---

## 1. Project Overview

| Field | Value |
|---|---|
| **App name** | Tlhiso |
| **Tagline** | Run Your Business. Smarter. |
| **Type** | Multi-industry SaaS business management platform |
| **Target market** | South African SMEs |
| **Industries served** | B2B · Medical & Health · Property Management · Consumer Business |
| **Owner / GitHub** | [@adobeing](https://github.com/adobeing) |
| **Contact email** | hello@tlhiso.com |

---

## 2. Live URLs

| Environment | URL | Firebase Project |
|---|---|---|
| **Production** | https://tlhiso.com · https://tlhiso.web.app | `tlhiso` |
| **Staging** | https://staging.tlhiso.com · https://tlhiso-staging.web.app | `tlhiso-staging` |
| **Firebase Console (prod)** | https://console.firebase.google.com/project/tlhiso | — |
| **Firebase Console (staging)** | https://console.firebase.google.com/project/tlhiso-staging | — |

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18 |
| Build tool | Vite | 5 |
| Routing | React Router | v6 |
| Styling | Tailwind CSS | 3 |
| Forms & validation | React Hook Form + Zod | — |
| Data fetching | TanStack Query | v5 |
| Charts | Recharts | 2 |
| Icons | Lucide React | — |
| Maps | Leaflet + react-leaflet | — |
| PDF generation | @react-pdf/renderer | — |
| CSV export | papaparse | — |
| Calendar | react-big-calendar | — |
| Backend / DB | Firebase v10 | — |
| Auth | Firebase Authentication | — |
| Database | Cloud Firestore | — |
| File storage | Firebase Storage | — |
| Backend functions | Firebase Cloud Functions (Node 20, 2nd gen) | — |
| Email | SendGrid | — |
| SMS | BulkSMS | South African API |
| WhatsApp | Twilio | — |
| Audio transcription | Google Cloud Speech-to-Text | — |
| Font | Plus Jakarta Sans (Google Fonts) | — |

---

## 4. Repository Structure

```
tlhiso/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── auth/              # LoginPage, RegisterPage, ForgotPassword, PendingActivation
│   │   ├── dashboards/
│   │   │   ├── b2b/           # B2BDashboard.jsx (clients, invoices, campaigns…)
│   │   │   ├── medical/       # MedicalDashboard.jsx (patients, consultations…)
│   │   │   ├── property/      # PropertyDashboard.jsx (properties, tenants…)
│   │   │   └── retail/        # RetailDashboard.jsx (customers, deals…)
│   │   ├── landing/           # LandingPage.jsx, LegalPage.jsx
│   │   ├── shared/            # DashboardLayout, DataTable, Modal, StatCard,
│   │   │                      #   ProfilePage, PopiaModule, Spinner
│   │   └── superadmin/        # SuperAdminDashboard.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx    # Firebase Auth + Firestore profile live subscription
│   ├── hooks/
│   │   └── useCollection.js   # Real-time Firestore collection hook
│   ├── routes/
│   │   ├── AppRoutes.jsx      # All route definitions
│   │   └── guards.jsx         # PrivateRoute, ActiveUserRoute, IndustryRoute, SuperAdminRoute
│   ├── services/
│   │   ├── firebase.js        # Dual-env Firebase init with fail-fast validation
│   │   └── messaging.js       # Unified sendMessage() → Cloud Functions
│   ├── styles/
│   │   └── global.css         # Tailwind base + CSS variables
│   └── utils/
│       ├── authErrors.js      # Firebase auth error → friendly messages
│       └── industries.js      # INDUSTRIES, PLANS, SUPER_ADMIN_EMAIL constants
├── functions/
│   └── index.js               # All 6 Cloud Functions
├── .env.production            # Firebase prod config (fill API keys)
├── .env.staging               # Firebase staging config (fill API keys)
├── firebase.json              # Hosting targets (production + staging)
├── .firebaserc                # Project aliases
├── firestore.rules            # Security rules
├── storage.rules              # Storage security rules
├── firestore.indexes.json
└── vite.config.js
```

---

## 5. Environment Variables

Fill these in `.env.production` and `.env.staging` from the Firebase Console
(**Project Settings → General → Your apps**):

```bash
VITE_APP_ENV=production              # or 'staging'
VITE_FIREBASE_API_KEY=               # ← paste from Firebase Console
VITE_FIREBASE_AUTH_DOMAIN=tlhiso.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tlhiso
VITE_FIREBASE_STORAGE_BUCKET=tlhiso.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=   # ← paste from Firebase Console
VITE_FIREBASE_APP_ID=                # ← paste from Firebase Console
VITE_RECAPTCHA_SITE_KEY=             # Google reCAPTCHA v3 site key
```

> **Never** put third-party API secrets in `.env` files. They live in Google Secret Manager only.

---

## 6. Cloud Function Secrets

All stored in Google Secret Manager. To update any of them:

```bash
firebase functions:secrets:set SECRET_NAME
```

| Secret name | Service | Value set? |
|---|---|---|
| `SENDGRID_API_KEY` | SendGrid | ✅ Set |
| `BULKSMS_TOKEN_ID` | BulkSMS | ✅ Set |
| `BULKSMS_TOKEN_SECRET` | BulkSMS | ✅ Set |
| `TWILIO_ACCOUNT_SID` | Twilio | ✅ Set |
| `TWILIO_AUTH_TOKEN` | Twilio | ✅ Set |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp | ✅ Set |
| `TWILIO_NUMBER` | Twilio SMS | ✅ Set |
| `PAYFAST_MERCHANT_ID` | PayFast | ✅ Set (live: `35654681`) |
| `PAYFAST_MERCHANT_KEY` | PayFast | ✅ Set |
| ~~`PAYFAST_PASSPHRASE`~~ | PayFast — **not used** | PayFast account has no passphrase set; all `pfSignature` calls use `null` |
| ~~`ASSEMBLYAI_API_KEY`~~ | ~~AssemblyAI~~ — replaced by GCP Speech-to-Text | N/A |

> Transcription (`transcribeConsultation`) now uses **Google Cloud Speech-to-Text** via the function's service account. No API key is required. Enable the API at: [console.cloud.google.com → APIs → Cloud Speech-to-Text API](https://console.cloud.google.com/apis/library/speech.googleapis.com)

---

## 7. Cloud Functions Reference

All functions are **2nd Gen, Node 20, us-central1**.

| Function name | Trigger | Purpose |
|---|---|---|
| `sendEmail` | HTTPS Callable | Send email via SendGrid |
| `sendSMS` | HTTPS Callable | Send SMS via BulkSMS (+27 SA format) |
| `sendWhatsApp` | HTTPS Callable | Send WhatsApp via Twilio |
| `transcribeConsultation` | HTTPS Callable | Upload audio → Google Cloud Speech-to-Text → return transcript |
| `sendActivationEmail` | HTTPS Callable | Email user when Super Admin activates their account |
| `deleteUserAccount` | HTTPS Callable | Deletes Firebase Auth account + Firestore doc (super admin only) |
| `notifyOnUserCreated` | Firestore `users/{userId}` onCreate | Email admin + welcome email to new registrant |
| `createPayfastCheckout` | HTTPS Callable | Creates PayFast Onsite subscription checkout (R10 trial → monthly plan) |
| `payfastIPN` | HTTPS Request | PayFast IPN handler for subscription payments; activates user + sends trial email |
| `createPayfastTopup` | HTTPS Callable | Creates PayFast Onsite one-off top-up for campaign message bundles |
| `createEventCheckout` | HTTPS Callable | Creates PayFast Onsite one-off payment for event launch (R6/guest + 15% VAT) |
| `eventPaymentIPN` | HTTPS Request | PayFast IPN handler for event launch payments; sets event status to launched |
| `createEventsActivationCheckout` | HTTPS Callable | Creates PayFast Onsite one-off payment to activate Events account (tier-based) |
| `eventsActivationIPN` | HTTPS Request | PayFast IPN handler for Events activation; sets `eventsActivated: true` on user |
| `launchEvent` | HTTPS Callable | Marks event as launched after payment confirmed |
| `submitRsvp` | HTTPS Callable | Public RSVP submission for event invites |
| `sendEventReminder` | HTTPS Callable | Sends email/SMS reminders to event guests |
| `sendEventThankYou` | HTTPS Callable | Sends post-event thank-you messages to guests |
| `processBilling` | Cloud Scheduler | Monthly billing via PayFast recurring; triggered by Pub/Sub schedule |
| `processScheduledCampaigns` | Cloud Scheduler | Fires scheduled campaigns at their send time |
| `processRecurringCampaigns` | Cloud Scheduler | Fires recurring campaign instances |
| `processAutomations` | Cloud Scheduler | Runs automation rules (birthday messages etc.) |
| `suggestCampaign` | HTTPS Callable | Gemini-powered campaign suggestion for a user |
| `sendAdminCampaign` | HTTPS Callable | Super admin broadcast campaign to all/filtered users |
| `superAdminChat` | HTTPS Callable | Super admin Gemini AI agent (13 tools) |
| `trackOpen` | HTTPS Request | Email open pixel tracker |
| `trackClick` | HTTPS Request | Email link click tracker |
| `shortenUrl` | HTTPS Callable | Shortens campaign URLs via is.gd |
| `unsubscribeContact` | HTTPS Request | Handles unsubscribe link clicks |
| `smsDeliveryWebhook` | HTTPS Request | BulkSMS delivery receipt webhook |
| `smsInboundWebhook` | HTTPS Request | BulkSMS inbound SMS webhook |
| `getPublicBookingInfo` | HTTPS Callable | Returns public booking page info for a user |
| `getPublicBookingSlots` | HTTPS Callable | Returns available appointment slots |
| `createPublicBooking` | HTTPS Callable | Creates a public appointment booking |
| `getTenantPortal` | HTTPS Callable | Returns tenant portal data |
| `createTenantMaintenance` | HTTPS Callable | Tenant submits a maintenance request |
| `generateWeeklySuggestions` | Cloud Scheduler | Generates weekly AI campaign suggestions for all users |
| `getProviderStats` | HTTPS Callable | Returns messaging provider stats for super admin |
| `computeBenchmarks` | Cloud Scheduler (nightly 00:00 UTC) | Zone B data engine — builds anonymised cohort benchmarks across all active users; writes to `analytics/benchmarks`. Cohorts below `MIN_COHORT_SIZE = 20` are suppressed. No individual user data ever written. |
| `recomputeBenchmarks` | HTTPS Callable (super admin only) | Manual trigger for `buildBenchmarks()` — same output as `computeBenchmarks`. Returns `{ success, period }`. |
| `generateMonthlyReport` | HTTPS Callable (super admin only) | Generates newsletter or operator PDF from `analytics/benchmarks` only; uploads to `reports/{period}/{type}.pdf` in Storage; returns 7-day signed URL + opted-in recipient count. No email sent. |
| `sendMonthlyNewsletter` | HTTPS Callable (super admin only) | Sends pre-generated newsletter PDF to all `marketingConsent === true` active users via SendGrid. Requires `confirm: true` in payload — aborts otherwise. Returns `{ sentCount, skippedOptOut }`. |

Callable usage from React:
```js
import { httpsCallable } from 'firebase/functions'
import { functions } from './services/firebase'

const result = await httpsCallable(functions, 'sendEmail')({
  to: 'user@example.com',
  subject: 'Hello',
  htmlBody: '<p>Hello from Tlhiso</p>',
})
```

Or use the unified wrapper:
```js
import { sendMessage } from './services/messaging'

await sendMessage({ type: 'sms', to: '+27821234567', body: 'Your appointment is confirmed.' })
await sendMessage({ type: 'email', to: 'user@example.com', subject: 'Invoice', body: '<p>...</p>' })
await sendMessage({ type: 'whatsapp', to: '+27821234567', body: 'Hi from Tlhiso' })
```

---

## 8. Firestore Data Structure

```
/users/{userId}
  uid, email, name, phone, industry, profession, plan
  isActive (bool)  ← false until Super Admin activates
  popiaConsent (bool), profilePhotoUrl, bankingDetails
  businessName, address, vatNumber, businessLogoUrl
  createdAt

/users/{userId}/customers/{id}      ← B2B clients / Retail customers
/users/{userId}/patients/{id}       ← Medical patients
/users/{userId}/tenants/{id}        ← Property tenants
/users/{userId}/properties/{id}     ← Property buildings
/users/{userId}/invoices/{id}
/users/{userId}/campaigns/{id}
/users/{userId}/consultations/{id}  ← Medical (includes transcript, audioUrl)
/users/{userId}/appointments/{id}
/users/{userId}/messages/{id}       ← Log of all sent messages
/users/{userId}/deals/{id}          ← Retail weekly deals
/users/{userId}/maintenance/{id}    ← Property maintenance logs
/users/{userId}/popia_consents/{id}
/users/{userId}/popia_requests/{id}
/users/{userId}/popia_breaches/{id}
```

---

## 9. User Activation Flow

1. User registers at `/register` → doc written with `isActive: false`
2. `notifyOnUserCreated` Cloud Function fires → emails `hello@tlhiso.com`
3. Super Admin logs in at `/superadmin/users`
4. Clicks **Activate** → Firestore `isActive` set to `true`
5. `sendActivationEmail` Cloud Function called → activation email sent to user
6. User can now log in and reach their industry dashboard

---

## 10. Super Admin Access

| Field | Value |
|---|---|
| **Login URL** | https://tlhiso.com/login |
| **Email** | admin@adobeing.com |
| **Dashboard** | https://tlhiso.com/superadmin |

The super admin check is enforced in two places:
- `SuperAdminRoute` guard (`src/routes/guards.jsx`) — checks email or Firebase Custom Claim `isAdmin: true`
- `firestore.rules` — grants broad read/write to the same email / claim

To grant super admin via Custom Claim (optional, more secure):
```js
// Run once via Firebase Admin SDK or Cloud Shell
admin.auth().setCustomUserClaims('<admin-uid>', { isAdmin: true })
```

---

## 11. Industry → Dashboard Routing

| Industry key | Dashboard path | Sidebar nav items |
|---|---|---|
| `b2b` | `/b2b/dashboard` | Dashboard, Clients, Invoices, Statements, Quotations, Projects, Service List, Appointments, Messages, Campaigns, Surveys, Marketing Opt-In, Profile, POPIA, Settings |
| `medical` | `/medical/dashboard` | Dashboard, Patients, Consultations, Medical Reports, Referrals, Appointments, Messages, Campaigns, Surveys, Practitioners, Profile, POPIA, Settings |
| `property` | `/property/dashboard` | Dashboard, Properties, Tenants, Statements, Invoices, Maintenance, Owners, Appointments, Messages, Campaigns, Documents, Profile, POPIA, Settings |
| `retail` | `/retail/dashboard` | Dashboard, Customers, Appointments, Messages, Campaigns, Weekly Deals, Surveys, Opt-In, Profile, POPIA, Settings |

---

## 12. Pricing Plans

Message quota applies to **campaigns only** (SMS + email). Booking confirmations, appointment reminders, and operational messages are free and unlimited.

Internal plan keys are stable (`starter` / `business` / `enterprise`) to avoid breaking existing Firestore user docs. Display names changed in v2.

| Internal key | Display name | Price | Campaign messages/mo | Ideal for |
|---|---|---|---|---|
| `starter` | **Starter** | R699/mo | 1,000 | All industries |
| `business` | **Professional** | R2,699/mo | 3,000 | Medical practices & doctors |
| `enterprise` | **Business** | R4,999/mo | 10,000 | B2B companies & property managers |

**Cost basis (SA market, conservative estimates):**
- BulkSMS: ~R0.30/SMS
- SendGrid: ~R0.007/email
- Assumed campaign mix: 60% email / 40% SMS
- Firebase/GCP infra: R30–80/user/month
- GCP Speech-to-Text (medical): ~R200/user/month
- Gross margin per plan: ~79–81%

---

## 13. Deployment Commands

```bash
# Local development
npm run dev

# Deploy to staging
npm run deploy:staging

# Deploy to production (hosting only)
npm run deploy:prod

# Deploy Cloud Functions only
firebase deploy --only functions

# Deploy Firestore rules only
firebase deploy --only firestore:rules

# Deploy storage rules only
firebase deploy --only storage

# Deploy everything
firebase deploy
```

---

## 14. DNS Configuration

Point these records at your domain registrar:

| Record | Name | Value |
|---|---|---|
| A | `tlhiso.com` | Firebase Hosting IP (see Console → Hosting → Custom domain) |
| CNAME | `www` | `tlhiso.com` |
| CNAME | `staging` | `tlhiso-staging.web.app` |

---

## 15. Deployment History

| Date | What was deployed | Notes |
|---|---|---|
| 2026-06-02 | **Full initial build** — all 20 parts from spec | First production deploy to tlhiso.web.app |
| 2026-06-02 | **Cloud Functions** — all 6 functions live | Node 20, 2nd gen. Secrets set in Secret Manager |
| 2026-06-02 | **Firestore rules deployed** | Fixed `permission-denied` on profile load |
| 2026-06-02 | **First user profile doc created** | `itupisces@gmail.com` / UID `0Lbs8DOCTXMb5oZpPxHdL6kr5IM2`, industry: medical, activated |
| 2026-06-19 | **PayFast integration** — checkout, IPN, Events activation, recurring billing | `createPayfastCheckout`, `payfastIPN`, `createPayfastTopup`, Events functions; passphrase removed (PayFast account has none) |
| 2026-06-19 | **Events dashboard** — tier-based activation page, EventsRoute guard, `eventsActivated` field | `src/components/events/`, `src/routes/guards.jsx`, `functions/events.js` |
| 2026-06-26 | **Super Admin Insights tab** — engagement KPIs, Recharts bar chart by industry, avg-campaigns-by-plan, Growth Opportunities DataTable | `src/components/superadmin/SuperAdminDashboard.jsx`, `src/components/shared/DashboardLayout.jsx` |
| 2026-06-26 | **Zone B benchmark functions** — `computeBenchmarks` (nightly scheduler) + `recomputeBenchmarks` (callable); writes anonymised cohort stats to `analytics/benchmarks`; `MIN_COHORT_SIZE = 20` suppression gate | `functions/index.js` |
| 2026-06-26 | **Monthly Report Generator** — `generateMonthlyReport` + `sendMonthlyNewsletter` callables; pdfkit newsletter + operator PDFs; Monthly Report card on Insights tab with confirm-gated send modal | `functions/index.js`, `functions/package.json`, `src/components/superadmin/SuperAdminDashboard.jsx` |

---

## 16. Known Issues & Resolutions

| Date | Issue | Root cause | Resolution |
|---|---|---|---|
| 2026-06-02 | `permission-denied` on Firestore profile load | `firestore.rules` was never deployed | `firebase deploy --only firestore:rules` |
| 2026-06-02 | Profile doc missing for first user | User created via Firebase Console, bypassing `RegisterPage` | Created doc manually via Firestore REST API |
| 2026-06-02 | Cloud Functions: `ERR_PACKAGE_PATH_NOT_EXPORTED` on `v2/auth` | `firebase-functions` v4 used; `onUserCreated` moved in v5 | Upgraded to `firebase-functions@latest`, replaced with `onDocumentCreated` Firestore trigger |
| 2026-06-02 | `beforeUserCreated` deploy error: GCIP required | Blocking Auth functions need Identity Platform (paid) | Replaced with Firestore `onDocumentCreated` trigger on `users/{userId}` |
| 2026-06-02 | Node 18 runtime decommissioned | `engines.node` was `"18"` in `functions/package.json` | Updated to `"20"` |
| 2026-06-19 | PayFast `400 — Generated signature does not match` | PayFast account has **no passphrase** set; code was appending `&passphrase=Tlhiso2024Pass` to the signing string | All `pfSignature(fields, passphrase)` calls changed to `pfSignature(fields, null)`; `PAYFAST_PASSPHRASE` removed from all function secret bindings |
| 2026-06-19 | PayFast signature mismatch (secondary) | `pfSignature` was sorting fields alphabetically but body builder used insertion order — PayFast Onsite verifies from the POST body in submission order | Removed `.sort()` from `pfSignature`; body and signature now both use insertion order |
| 2026-06-20 | PayFast subscription checkout 400 "signature does not match" | `custom_str1`/`custom_str2` fields were placed after subscription fields (`subscription_type`, `billing_date`, etc.) — PayFast Onsite verifies in POST body order, so the field order in the code is the signing order | Moved `custom_str1`/`custom_str2` before subscription fields in `createPayfastCheckout`; confirmed working via isolation test (once-off succeeded, subscription with corrected order succeeded). Passphrase `Tlhiso2025Pass` set in both Secret Manager (version 6) and PayFast merchant portal. See `docs/payfast-integration.md`. |

---

## 17. POPIA Compliance Notes

This platform handles personal information under South Africa's **Protection of Personal Information Act (POPIA)**. Each industry dashboard includes:
- **Consent Register** — tracks who gave consent, when, and for what purpose
- **Data Subject Requests** — access, correction, deletion requests with 30-day deadline tracking
- **POPIA Notice Generator** — auto-filled PDF/text notice using business profile details
- **Data Breach Log** — records breaches with nature, affected parties, and regulatory reporting status

---

## 18. South Africa–Specific Implementation Notes

| Requirement | Implementation |
|---|---|
| Phone numbers | Stored and sent in `+27XXXXXXXXX` E.164 format. `0XX` numbers are auto-normalised on registration and SMS send. |
| ID numbers | 13-digit RSA ID validation regex applied in Medical patient form |
| Currency | ZAR (R). All prices displayed with `toLocaleString('en-ZA')` |
| VAT | 15% applied on invoice totals |
| POPIA | Full module on every dashboard. Not GDPR. |
| SMS provider | BulkSMS — South African gateway, Basic Auth with Token ID + Secret |

---

## 19. Adding a New User Manually

If a user signs up via Google or was created directly in Firebase Console (bypassing the Register form), create their Firestore profile doc manually:

1. Go to [Firebase Console → Firestore → users](https://console.firebase.google.com/project/tlhiso/firestore/data/users)
2. Add document with ID = the user's UID
3. Set these fields:

```json
{
  "uid": "<uid>",
  "email": "<email>",
  "name": "<display name>",
  "industry": "b2b|medical|property|retail",
  "plan": "starter",
  "isActive": true,
  "popiaConsent": true,
  "profilePhotoUrl": "",
  "bankingDetails": null,
  "phone": "",
  "createdAt": <server timestamp>
}
```

---

## 20. Contact & Links

| | |
|---|---|
| **Support email** | hello@tlhiso.com |
| **GitHub** | https://github.com/adobeing |
| **Production** | https://tlhiso.com |
| **Staging** | https://tlhiso-staging.web.app |
| **Firebase Console** | https://console.firebase.google.com/project/tlhiso |
