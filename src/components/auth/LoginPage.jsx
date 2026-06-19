import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { dashboardPathFor, SUPER_ADMIN_EMAIL } from '../../utils/industries'
import { friendlyAuthError } from '../../utils/authErrors'
import AuthShell from './AuthShell'
import { Field, Button, FormError } from './fields'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(schema) })

  // After auth, decide where to land based on the Firestore profile.
  async function routeAfterLogin(uid, email) {
    if (email?.toLowerCase() === SUPER_ADMIN_EMAIL) return navigate('/superadmin')
    const snap = await getDoc(doc(db, 'users', uid))
    const data = snap.exists() ? snap.data() : null
    if (!data) return setFormError('Profile not found. Contact hello@tlhiso.com.')
    if (!data.isActive) {
      return navigate(data.industry === 'events' ? '/events/activate' : '/pending-activation')
    }
    navigate(dashboardPathFor(data.industry))
  }

  async function onSubmit({ email, password }) {
    setFormError('')
    try {
      const cred = await login(email, password)
      await routeAfterLogin(cred.user.uid, cred.user.email)
    } catch (err) {
      setFormError(friendlyAuthError(err))
    }
  }

  async function onGoogle() {
    setFormError('')
    try {
      const cred = await loginWithGoogle()
      await routeAfterLogin(cred.user.uid, cred.user.email)
    } catch (err) {
      setFormError(friendlyAuthError(err))
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Tlhiso workspace."
      footer={<>Don’t have an account? <Link to="/register" className="font-semibold text-primary">Create one</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormError>{formError}</FormError>
        <Field label="Email" type="email" autoComplete="email"
          error={errors.email?.message} {...register('email')} />
        <Field label="Password" type="password" autoComplete="current-password"
          error={errors.password?.message} {...register('password')} />
        <div className="text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-primary">Forgot password?</Link>
        </div>
        <Button type="submit" loading={isSubmitting}>Sign in</Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-secondary">
        <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="ghost" type="button" onClick={onGoogle}>Continue with Google</Button>
    </AuthShell>
  )
}
