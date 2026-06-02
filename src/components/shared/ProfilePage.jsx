import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { PLANS } from '../../utils/industries'

const profileSchema = z.object({
  name: z.string().min(2),
  businessName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
})

const bankSchema = z.object({
  bankName: z.string().min(2, 'Bank name required'),
  accountHolder: z.string().min(2, 'Account holder required'),
  accountNumber: z.string().min(5, 'Account number required'),
  branchCode: z.string().min(4, 'Branch code required'),
  accountType: z.enum(['Cheque', 'Savings', 'Transmission']),
})

function Section({ title, children }) {
  return (
    <div className="rounded-card border border-border bg-white p-6 shadow-card">
      <h3 className="mb-5 text-base font-bold text-ink">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, error, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">{label}</span>
      <input {...props}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 ${error ? 'border-red-400' : 'border-border'}`} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

export default function ProfilePage({ industry }) {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoFile, setLogoFile] = useState(null)

  const plan = PLANS[profile?.plan] ?? PLANS.starter

  const { register: regProfile, handleSubmit: hProfile, formState: { errors: pErr } } =
    useForm({ resolver: zodResolver(profileSchema), defaultValues: profile ?? {} })

  const { register: regBank, handleSubmit: hBank, formState: { errors: bErr } } =
    useForm({ resolver: zodResolver(bankSchema), defaultValues: profile?.bankingDetails ?? {} })

  async function saveProfile(values) {
    if (!uid) return
    setSaving(true)
    try {
      let logoUrl = profile?.businessLogoUrl ?? ''
      if (logoFile) {
        const storageRef = ref(storage, `users/${uid}/logo`)
        await uploadBytes(storageRef, logoFile)
        logoUrl = await getDownloadURL(storageRef)
      }
      await updateDoc(doc(db, 'users', uid), { ...values, businessLogoUrl: logoUrl })
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

  return (
    <div className="max-w-2xl space-y-6">
      {saved && (
        <div className="rounded-xl bg-primary-light border border-primary/30 px-4 py-3 text-sm font-semibold text-primary">
          Saved successfully ✓
        </div>
      )}

      <Section title="Personal / Business Info">
        <form onSubmit={hProfile(saveProfile)} className="space-y-4">
          <Field label="Full name" error={pErr.name?.message} {...regProfile('name')} />
          <Field label="Business name" {...regProfile('businessName')} />
          <Field label="Phone" {...regProfile('phone')} />
          <Field label="Address" {...regProfile('address')} />
          <Field label="VAT number" placeholder="e.g. 4123456789" {...regProfile('vatNumber')} />
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Business logo</span>
            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-ink-secondary" />
            {profile?.businessLogoUrl && (
              <img src={profile.businessLogoUrl} alt="Logo" className="mt-2 h-12 rounded-lg object-contain" />
            )}
          </div>
          <button type="submit" disabled={saving}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </Section>

      <Section title="Banking Details">
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          ⚠️ Keep your banking details up to date to ensure correct payment information on your invoices.
        </div>
        <form onSubmit={hBank(saveBanking)} className="space-y-4">
          <Field label="Bank name" error={bErr.bankName?.message} {...regBank('bankName')} />
          <Field label="Account holder name" error={bErr.accountHolder?.message} {...regBank('accountHolder')} />
          <Field label="Account number" error={bErr.accountNumber?.message} {...regBank('accountNumber')} />
          <Field label="Branch code" error={bErr.branchCode?.message} {...regBank('branchCode')} />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Account type</span>
            <select {...regBank('accountType')}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary">
              <option value="Cheque">Cheque</option>
              <option value="Savings">Savings</option>
              <option value="Transmission">Transmission</option>
            </select>
          </label>
          <button type="submit" disabled={saving}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Banking Details'}
          </button>
        </form>
      </Section>

      <Section title="Subscription">
        <div className="rounded-xl border border-primary/30 bg-primary-light p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-ink capitalize">{plan.name} Plan</p>
              <p className="text-xs text-ink-secondary mt-0.5">R{plan.price.toLocaleString()}/month · {plan.messages.toLocaleString()} messages</p>
            </div>
            <a href="#pricing"
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-[#4e7d6d]">
              Upgrade
            </a>
          </div>
        </div>
      </Section>
    </div>
  )
}
