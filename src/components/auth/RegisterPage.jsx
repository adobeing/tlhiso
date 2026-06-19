import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { INDUSTRY_LIST, INDUSTRIES, PLAN_LIST } from '../../utils/industries'
import { friendlyAuthError } from '../../utils/authErrors'
import AuthShell from './AuthShell'
import { Field, Button, FormError } from './fields'

// SA phone: accepts +27XXXXXXXXX or 0XXXXXXXXX, normalised to +27 on save.
const phoneRe = /^(\+27|0)[6-8][0-9]{8}$/
const step1Schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(phoneRe, 'Enter a valid SA mobile number'),
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  path: ['confirm'], message: 'Passwords do not match',
})

function normalizePhone(p) {
  return p.startsWith('0') ? '+27' + p.slice(1) : p
}

const Stepper = ({ step }) => (
  <div className="mb-6 flex items-center gap-2">
    {[1, 2, 3].map((n) => (
      <div key={n}
        className={`h-1.5 flex-1 rounded-full transition ${n <= step ? 'bg-primary' : 'bg-border'}`} />
    ))}
  </div>
)

export default function RegisterPage() {
  const { register: registerUser, setDisplayName } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [data, setData] = useState({})
  const [industry, setIndustry] = useState(null)
  const [profession, setProfession] = useState('')
  const [plan, setPlan] = useState(null)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors } } =
    useForm({ resolver: zodResolver(step1Schema) })

  function submitStep1(values) {
    setData({ ...values, phone: normalizePhone(values.phone) })
    setStep(2)
  }

  async function finish() {
    setFormError('')
    setSubmitting(true)
    try {
      const cred = await registerUser(data.email, data.password)
      const uid = cred.user.uid
      await setDisplayName(data.name)
      // Persist the profile. isActive:false → admin must approve. A Cloud
      // Function (onUserCreated / sendActivationEmail) handles the emails.
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: data.email,
        name: data.name,
        phone: data.phone,
        industry,
        profession,
        plan,
        isActive: false,
        popiaConsent: true,
        marketingConsent: true,
        profilePhotoUrl: '',
        bankingDetails: null,
        createdAt: serverTimestamp(),
      })
      // Event Planners use pay-as-you-go — skip subscription checkout
      navigate(industry === 'events' ? '/events/activate' : '/checkout', { replace: true })
    } catch (err) {
      setFormError(friendlyAuthError(err))
      setStep(1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Get started with Tlhiso in a few steps."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></>}
    >
      <Stepper step={step} />
      <FormError>{formError}</FormError>

      {step === 1 && (
        <form onSubmit={handleSubmit(submitStep1)} className="space-y-4">
          <Field label="Full name" error={errors.name?.message} {...register('name')} />
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Field label="Phone" placeholder="+27…" error={errors.phone?.message} {...register('phone')} />
          <Field label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          <p className="text-xs text-ink-secondary">
            By creating an account you agree to our{' '}
            <Link to="/legal/terms" className="font-semibold text-primary">Terms of Service</Link> &{' '}
            <Link to="/legal/privacy" className="font-semibold text-primary">Privacy Policy</Link>.
          </p>
          <Button type="submit">Continue</Button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="label-caps mb-2 text-xs text-ink-secondary">Select your industry</p>
            <div className="grid grid-cols-2 gap-3">
              {INDUSTRY_LIST.map((ind) => (
                <button key={ind.key} type="button"
                  onClick={() => { setIndustry(ind.key); setProfession('') }}
                  className={`rounded-xl border p-4 text-left transition ${
                    industry === ind.key ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/50'}`}>
                  <span className="text-2xl">{ind.icon}</span>
                  <p className="mt-2 text-sm font-semibold text-ink">{ind.label}</p>
                </button>
              ))}
            </div>
          </div>
          {industry && (
            <label className="block">
              <span className="label-caps mb-1.5 block text-xs text-ink-secondary">Profession</span>
              <select value={profession} onChange={(e) => setProfession(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/40">
                <option value="">Select…</option>
                {INDUSTRIES[industry].professions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={() => setStep(1)}>Back</Button>
            <Button type="button"
              onClick={() => industry === 'events' ? finish() : setStep(3)}
              loading={industry === 'events' ? submitting : false}
              {...(!industry || !profession ? { disabled: true } : {})}>
              {industry === 'events' ? 'Create account' : 'Continue'}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <p className="label-caps text-xs text-ink-secondary">Choose your plan</p>
          <div className="space-y-3">
            {PLAN_LIST.map((p) => (
              <button key={p.key} type="button" onClick={() => setPlan(p.key)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                  plan === p.key ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/50'}`}>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {p.name}{p.popular && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white">Popular</span>}
                  </p>
                  <p className="text-xs text-ink-secondary">{p.messages.toLocaleString()} campaign messages / month</p>
                  {p.idealFor && <p className="text-[11px] text-ink-secondary/70 italic">{p.idealFor}</p>}
                </div>
                <p className="text-sm font-bold text-ink">R{p.price.toLocaleString()}<span className="text-xs font-normal text-ink-secondary">/mo</span></p>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={() => setStep(2)}>Back</Button>
            <Button type="button" onClick={finish} loading={submitting}
              {...(!plan ? { disabled: true } : {})}>Create account</Button>
          </div>
        </div>
      )}

    </AuthShell>
  )
}
