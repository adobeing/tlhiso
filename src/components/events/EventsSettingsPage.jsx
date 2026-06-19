import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { CheckCircle, AlertCircle, Bell, CreditCard, Info } from 'lucide-react'
import DashboardLayout from '../shared/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { db } from '../../services/firebase'

export default function EventsSettingsPage() {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [emailNotifs, setEmailNotifs] = useState(profile?.eventsEmailNotifs ?? true)
  const [smsNotifs, setSmsNotifs]     = useState(profile?.eventsSmsNotifs ?? true)

  async function handleSave() {
    if (!profile?.uid) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        eventsEmailNotifs: emailNotifs,
        eventsSmsNotifs: smsNotifs,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout industry="events" pageTitle="Settings">
      <div className="mx-auto max-w-xl space-y-6">

        {/* Notifications */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h3 className="font-bold text-slate-800">Notifications</h3>
          </div>

          {[
            { label: 'Email notifications', sub: 'Receive RSVP updates and event reminders via email', value: emailNotifs, onChange: setEmailNotifs },
            { label: 'SMS notifications',   sub: 'Receive RSVP updates via SMS',                      value: smsNotifs,   onChange: setSmsNotifs },
          ].map(({ label, sub, value, onChange }) => (
            <label key={label} className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4 hover:border-primary/30 transition">
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => onChange(!value)}
                className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </label>
          ))}
        </div>

        {/* Billing info */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard size={16} className="text-primary" />
            <h3 className="font-bold text-slate-800">Billing</h3>
          </div>
          <div className="rounded-2xl bg-primary/5 px-4 py-4 space-y-2">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 flex-shrink-0 text-primary" />
              <p className="text-sm text-slate-700">
                Events billing is <strong>pay-per-use</strong> — R6 per guest charged once when you launch an event.
                No monthly subscription fee.
              </p>
            </div>
            <ul className="ml-5 space-y-1 text-xs text-slate-500 list-disc">
              <li>100 guests → R345</li>
              <li>500 guests → R690</li>
              <li>1,000 guests → R1,225</li>
              <li>10,000 guests → R5,450</li>
            </ul>
            <p className="text-xs text-slate-400">Payments processed securely via PayFast.</p>
          </div>
        </div>

        {/* Feedback */}
        {saved && (
          <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle size={14} />
            Settings saved.
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={14} />
            {saveError}
          </div>
        )}

        <div className="pb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

      </div>
    </DashboardLayout>
  )
}
