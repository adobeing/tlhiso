import { useState, forwardRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, storage, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { PLANS } from '../../utils/industries'
import {
  User, Building2, Landmark, CreditCard, AlertTriangle, CheckCircle2,
  Upload, Sparkles,
} from 'lucide-react'

const profileSchema = z.object({
  name: z.string().min(2),
  businessName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  googleReviewLink: z.string().optional(),
})

const bankSchema = z.object({
  bankName: z.string().min(2, 'Bank name required'),
  accountHolder: z.string().min(2, 'Account holder required'),
  accountNumber: z.string().min(5, 'Account number required'),
  branchCode: z.string().min(4, 'Branch code required'),
  accountType: z.enum(['Cheque', 'Savings', 'Transmission']),
})

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '–'
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={17} />
          </span>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

const Field = forwardRef(function Field({ label, error, hint, ...props }, ref) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input ref={ref} {...props}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${error ? 'border-red-400' : 'border-slate-200'}`} />
      {hint && <span className="mt-1 block text-[11px] text-slate-600/70">{hint}</span>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
})

export default function ProfilePage({ industry }) {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [logoFile,     setLogoFile]     = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const plan = PLANS[profile?.plan] ?? PLANS.starter
  const used = profile?.messagesUsed ?? 0
  const pct = Math.min(100, Math.round((used / (plan.messages || 1)) * 100))

  const { register: regProfile, handleSubmit: hProfile, formState: { errors: pErr }, reset: resetProfile } =
    useForm({ resolver: zodResolver(profileSchema), defaultValues: profile ?? {} })

  const { register: regBank, handleSubmit: hBank, formState: { errors: bErr }, reset: resetBank } =
    useForm({ resolver: zodResolver(bankSchema), defaultValues: profile?.bankingDetails ?? {} })

  // Pre-fill forms once profile arrives from Firestore (uid-scoped so edits aren't clobbered)
  useEffect(() => {
    if (profile) {
      resetProfile({
        name:             profile.name             ?? '',
        businessName:     profile.businessName     ?? '',
        phone:            profile.phone            ?? '',
        address:          profile.address          ?? '',
        vatNumber:        profile.vatNumber        ?? '',
        googleReviewLink: profile.googleReviewLink ?? '',
      })
    }
  }, [profile?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile?.bankingDetails) resetBank(profile.bankingDetails)
  }, [profile?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  // Logo uploads independently — no dependency on the profile form being valid
  async function uploadLogo(file) {
    if (!uid || !file) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase() || 'png'
      const storageRef = ref(storage, `users/${uid}/logo.${ext}`)
      await uploadBytes(storageRef, file)
      const logoUrl = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'users', uid), { businessLogoUrl: logoUrl })
      setLogoFile(null)
    } catch (e) {
      alert(`Logo upload failed: ${e.message}`)
    } finally {
      setUploadingLogo(false)
    }
  }

  async function saveProfile(values) {
    if (!uid) return
    setSaving(true)
    try {
      const payload = { ...values }
      // Shorten Google Review link whenever it changes
      if (values.googleReviewLink && values.googleReviewLink !== profile?.googleReviewLink) {
        try {
          const result = await httpsCallable(functions, 'shortenUrl')({ url: values.googleReviewLink })
          if (result.data?.shortUrl) payload.googleReviewLinkShort = result.data.shortUrl
        } catch { /* fall back to original if shortening fails */ }
      } else if (!values.googleReviewLink) {
        payload.googleReviewLinkShort = ''
      }
      await updateDoc(doc(db, 'users', uid), payload)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  async function saveBanking(values) {
    if (!uid) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', uid), { bankingDetails: values })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const displayName = profile?.businessName || profile?.name || 'Your Profile'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Profile header band */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-primary to-[#7BA897]" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="-mt-9 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-primary/10 text-2xl font-bold text-primary shadow-sm">
            {profile?.businessLogoUrl
              ? <img src={profile.businessLogoUrl} alt="Logo" className="h-full w-full object-contain" />
              : initials(displayName)}
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <h2 className="truncate text-lg font-bold text-slate-800">{displayName}</h2>
            <p className="text-xs text-slate-600">{profile?.email}{profile?.phone ? ` · ${profile.phone}` : ''}</p>
          </div>
          <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary ring-1 ring-inset ring-primary/20">
            <Sparkles size={12} /> {plan.name} Plan
          </span>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
          <CheckCircle2 size={16} /> Saved successfully
        </div>
      )}

      <Section icon={User} title="Personal / Business Info" subtitle="Shown on invoices, statements and reports">
        <form onSubmit={hProfile(saveProfile)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={pErr.name?.message} {...regProfile('name')} />
            <Field label="Business name" {...regProfile('businessName')} />
            <Field label="Phone" {...regProfile('phone')} />
            <Field label="VAT number" placeholder="e.g. 4123456789" {...regProfile('vatNumber')} />
          </div>
          <Field label="Address" {...regProfile('address')} />
          <Field
            label="Google Review link"
            placeholder="https://g.page/r/…/review"
            hint={profile?.googleReviewLinkShort
              ? `Short link: ${profile.googleReviewLinkShort} — used in SMS & email`
              : 'Paste your link and save — a short URL will be generated automatically.'}
            {...regProfile('googleReviewLink')}
          />
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Business logo</span>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {profile?.businessLogoUrl
                  ? <img src={profile.businessLogoUrl} alt="Logo" className="h-full w-full object-contain" />
                  : <Building2 size={20} className="text-slate-600" />}
              </div>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-xs font-semibold transition ${uploadingLogo ? 'border-primary/40 text-primary' : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}>
                {uploadingLogo
                  ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />Uploading…</>
                  : <><Upload size={14} />{logoFile ? logoFile.name : 'Upload logo'}</>}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingLogo}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { setLogoFile(file); uploadLogo(file) }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4e7d6d] disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Section>

      <Section icon={Landmark} title="Banking Details" subtitle="Displayed on invoices and statements for payment">
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Keep your banking details up to date to ensure correct payment information on your invoices.
        </div>
        <form onSubmit={hBank(saveBanking)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name" error={bErr.bankName?.message} {...regBank('bankName')} />
            <Field label="Account holder name" error={bErr.accountHolder?.message} {...regBank('accountHolder')} />
            <Field label="Account number" error={bErr.accountNumber?.message} {...regBank('accountNumber')} />
            <Field label="Branch code" error={bErr.branchCode?.message} {...regBank('branchCode')} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Account type</span>
            <select {...regBank('accountType')}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="Cheque">Cheque</option>
              <option value="Savings">Savings</option>
              <option value="Transmission">Transmission</option>
            </select>
          </label>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4e7d6d] disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Banking Details'}
            </button>
          </div>
        </form>
      </Section>

      <Section icon={CreditCard} title="Subscription" subtitle="Your current plan and message usage">
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold capitalize text-slate-800">{plan.name} Plan</p>
              <p className="mt-0.5 text-xs text-slate-600">R{plan.price.toLocaleString()}/month · {plan.messages.toLocaleString()} campaign messages included</p>
            </div>
            <a href="/#pricing" target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#4e7d6d]">
              Upgrade Plan
            </a>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>Campaign messages used this month</span>
              <span>{used.toLocaleString()} / {plan.messages.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
              <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
