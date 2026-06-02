// Map Firebase Auth error codes to plain, user-facing messages.
const MAP = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled. Contact hello@tlhiso.com.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/weak-password': 'Password should be at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again shortly.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/network-request-failed': 'Network error. Check your connection and retry.',
}
export function friendlyAuthError(err) {
  return MAP[err?.code] ?? 'Something went wrong. Please try again.'
}
