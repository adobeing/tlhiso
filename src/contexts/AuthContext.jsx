// Auth state + the Firestore user profile, exposed app-wide.
//
// We deliberately track TWO things:
//   - `user`    : the Firebase Auth user (identity)
//   - `profile` : the Firestore users/{uid} doc (industry, plan, isActive...)
// Route guards need the profile, not just the auth user, so we resolve both
// before reporting `loading: false`. This avoids the flash where a logged-in
// but not-yet-loaded user is wrongly bounced to /login.
import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db, googleProvider } from '../services/firebase'
import { SUPER_ADMIN_EMAIL } from '../utils/industries'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      // Tear down any previous profile listener on user change.
      if (unsubProfile) { unsubProfile(); unsubProfile = null }

      if (!fbUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(fbUser)

      // Live-subscribe to the profile so isActive flips (e.g. admin activates
      // the account) are reflected without a manual refresh.
      const ref = doc(db, 'users', fbUser.uid)
      try {
        const snap = await getDoc(ref)
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      } catch (e) {
        console.error('[auth] failed to load profile', e)
        setProfile(null)
      }
      unsubProfile = onSnapshot(
        ref,
        (snap) => setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null),
        (e) => console.error('[auth] profile listener error', e),
      )
      setLoading(false)
    })

    return () => {
      if (unsubProfile) unsubProfile()
      unsubAuth()
    }
  }, [])

  const login = useCallback(
    (email, password) => signInWithEmailAndPassword(auth, email, password),
    [],
  )
  const register = useCallback(
    (email, password) => createUserWithEmailAndPassword(auth, email, password),
    [],
  )
  const loginWithGoogle = useCallback(
    () => signInWithPopup(auth, googleProvider),
    [],
  )
  const resetPassword = useCallback(
    (email) => sendPasswordResetEmail(auth, email),
    [],
  )
  const signOut = useCallback(() => fbSignOut(auth), [])
  const setDisplayName = useCallback(
    (name) => (auth.currentUser ? fbUpdateProfile(auth.currentUser, { displayName: name }) : null),
    [],
  )

  const isSuperAdmin = useMemo(
    () => user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL,
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      isActive: !!profile?.isActive,
      isSuperAdmin,
      industry: profile?.industry ?? null,
      login,
      register,
      loginWithGoogle,
      resetPassword,
      signOut,
      setDisplayName,
    }),
    [user, profile, loading, isSuperAdmin, login, register, loginWithGoogle, resetPassword, signOut, setDisplayName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
