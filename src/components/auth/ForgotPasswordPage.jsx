import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../contexts/AuthContext'
import { friendlyAuthError } from '../../utils/authErrors'
import AuthShell from './AuthShell'
import { Field, Button, FormError } from './fields'

const schema = z.object({ email: z.string().email('Enter a valid email') })

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(schema) })

  async function onSubmit({ email }) {
    setFormError('')
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setFormError(friendlyAuthError(err))
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a secure link to set a new password."
      footer={<><Link to="/login" className="font-semibold text-primary">Back to sign in</Link></>}
    >
      {sent ? (
        <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-4 text-sm text-ink">
          If an account exists for that email, a reset link is on its way.
          The link comes from your active Tlhiso project — check spam if you don’t see it.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormError>{formError}</FormError>
          <Field label="Email" type="email" autoComplete="email"
            error={errors.email?.message} {...register('email')} />
          <Button type="submit" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  )
}
