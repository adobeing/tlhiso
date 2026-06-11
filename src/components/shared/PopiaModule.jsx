import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import DataTable from './DataTable'
import { fmtDate } from '../../utils/dates'

const TABS = ['Consent Register', 'Data Subject Requests', 'POPIA Notice', 'Data Breach Log']

export default function PopiaModule({ subCollection = 'customers' }) {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState(0)
  const [breachNote, setBreachNote] = useState('')

  const consents = useCollection(uid ? `users/${uid}/popia_consents` : null)
  const requests = useCollection(uid ? `users/${uid}/popia_requests` : null)
  const breaches = useCollection(uid ? `users/${uid}/popia_breaches` : null)

  const consentCols = [
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'method', label: 'Method' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'optOutDate', label: 'Opt-out Date', render: r => fmtDate(r.optOutDate) },
  ]
  const requestCols = [
    { key: 'subject', label: 'Subject' },
    { key: 'type', label: 'Request Type' },
    { key: 'status', label: 'Status', render: r => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        r.status === 'Resolved' ? 'bg-green-100 text-green-700' :
        r.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
        'bg-amber-100 text-amber-700'
      }`}>{r.status}</span>
    )},
    { key: 'deadline', label: 'Deadline (30 days)', render: r => fmtDate(r.deadline) },
  ]
  const breachCols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'nature', label: 'Nature' },
    { key: 'affected', label: 'Affected Parties' },
    { key: 'action', label: 'Action Taken' },
    { key: 'reported', label: 'Reported to Regulator' },
  ]

  function generateNotice() {
    const text = `POPIA PRIVACY NOTICE\n\n` +
      `Business: ${profile?.businessName ?? profile?.name ?? 'N/A'}\n` +
      `Contact: ${profile?.email ?? user?.email ?? 'N/A'}\n` +
      `Phone: ${profile?.phone ?? 'N/A'}\n` +
      `Address: ${profile?.address ?? 'N/A'}\n\n` +
      `We collect and process personal information for the purposes of providing our services to you. ` +
      `Your information is stored securely and will not be shared with third parties without your consent, ` +
      `except as required by law. You have the right to access, correct, or request deletion of your data. ` +
      `Contact us at ${profile?.email ?? user?.email ?? 'hello@tlhiso.com'} for any data-related requests.\n\n` +
      `Data Officer: ${profile?.popiaOfficer ?? profile?.name ?? 'N/A'}\n` +
      `Generated: ${new Date().toLocaleDateString('en-ZA')}`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'popia-notice.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  async function logBreach() {
    if (!uid || !breachNote.trim()) return
    await addDoc(collection(db, 'users', uid, 'popia_breaches'), {
      date: new Date().toLocaleDateString('en-ZA'),
      nature: breachNote,
      affected: 'Unknown',
      action: 'Under investigation',
      reported: 'No',
      createdAt: serverTimestamp(),
    })
    setBreachNote('')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">POPIA Compliance</h2>
        <p className="mt-0.5 text-sm text-slate-600">Manage consent, data subject requests, privacy notices and breach records.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === i ? 'bg-primary text-white' : 'border border-slate-200 text-slate-600 hover:border-primary/50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <DataTable columns={consentCols} data={consents ?? []} emptyMessage="No consent records yet." />}
      {tab === 1 && <DataTable columns={requestCols} data={requests ?? []} emptyMessage="No data subject requests." />}
      {tab === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">POPIA Privacy Notice Generator</h3>
          <p className="text-sm text-slate-600">Generate a customised POPIA notice using your business profile details.</p>
          <button onClick={generateNotice}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
            Download POPIA Notice
          </button>
        </div>
      )}
      {tab === 3 && (
        <div className="space-y-4">
          <DataTable columns={breachCols} data={breaches ?? []} emptyMessage="No breaches logged." />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-slate-800 text-sm">Log a Data Breach</h3>
            <textarea value={breachNote} onChange={e => setBreachNote(e.target.value)}
              placeholder="Describe the nature of the breach…"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 h-24 resize-none" />
            <button onClick={logBreach}
              className="mt-3 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600">
              Log Breach
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
