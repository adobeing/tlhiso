// ---------------------------------------------------------------------------
// Firebase initialization with strict environment isolation.
//
// The auth-domain mismatch that breaks password-reset / login happens when a
// build picks up the wrong project's config. We prevent that two ways:
//   1. Every value comes from import.meta.env (the .env.[mode] file Vite loads
//      for the active --mode). Nothing is hardcoded per-environment.
//   2. We assert the config is internally consistent at startup and fail loud
//      in dev if a required key is missing, so a half-populated .env can never
//      silently ship.
//
// authDomain MUST match the project whose API key you are using. If reset
// emails point at the wrong project, the cause is almost always an authDomain
// here that belongs to the other environment.
// ---------------------------------------------------------------------------
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'staging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// --- Fail-fast validation ---------------------------------------------------
const REQUIRED = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]
const missing = REQUIRED.filter((k) => !firebaseConfig[k])
if (missing.length) {
  const msg = `[firebase] Missing config keys for env "${APP_ENV}": ${missing.join(', ')}. ` +
    `Check your .env.${APP_ENV === 'production' ? 'production' : 'staging'} file.`
  if (import.meta.env.DEV) throw new Error(msg)
  else console.error(msg)
}

// Sanity check: authDomain should reference the same project as projectId.
// This is the single most common cause of cross-environment auth failures.
if (
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  !firebaseConfig.authDomain.startsWith(firebaseConfig.projectId)
) {
  console.warn(
    `[firebase] authDomain "${firebaseConfig.authDomain}" does not match ` +
    `projectId "${firebaseConfig.projectId}". Password-reset and OAuth links ` +
    `will point at the wrong project. Verify your .env.${APP_ENV} file.`
  )
}

const app = initializeApp(firebaseConfig)

// --- App Check (reCAPTCHA v3) ------------------------------------------------
// Protects Firestore / Storage / Cloud Functions against abuse. The site key
// must be registered under App Check for this app in the Firebase Console
// (per environment) before enforcement is switched on there.
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY
if (RECAPTCHA_SITE_KEY) {
  // In local dev the registered domains won't match localhost; a debug token
  // (printed to the browser console on first run, then whitelisted in the
  // Firebase Console) keeps everything working.
  if (import.meta.env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  } catch (e) {
    console.error('[firebase] App Check init failed:', e.message)
  }
} else {
  console.warn(`[firebase] VITE_RECAPTCHA_SITE_KEY missing for env "${APP_ENV}" — App Check disabled.`)
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)
export const googleProvider = new GoogleAuthProvider()
export const appEnv = APP_ENV
export const projectId = firebaseConfig.projectId

export default app
