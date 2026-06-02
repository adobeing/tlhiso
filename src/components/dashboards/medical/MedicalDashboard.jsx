import { useState, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import PopiaModule from '../../shared/PopiaModule'
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, functions } from '../../../services/firebase'
import { httpsCallable } from 'firebase/functions'
import { PlusCircle, Trash2, Mic, Square } from 'lucide-react'

function Field({ label, error, textarea, select, children, ...props }) {
  const cls = 'w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">{label}</span>
      {textarea ? <textarea {...props} className={cls + ' resize-none h-24'} /> :
       select ? <select {...props} className={cls}>{children}</select> :
       <input {...props} className={cls} />}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  const { user } = useAuth()
  const uid = user?.uid
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const consultations = useCollection(uid ? `users/${uid}/consultations` : null)
  const today = new Date().toISOString().slice(0, 10)
  const todayAppts = appointments.filter(a => a.date === today)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Patients" value={patients.length} icon="🫀" />
        <StatCard label="Today's Appointments" value={todayAppts.length} icon="📅" color="blue" />
        <StatCard label="Consultations This Week" value={consultations.length} icon="🩺" color="purple" />
        <StatCard label="Pending Referrals" value={0} icon="📋" color="orange" />
      </div>
      <div className="rounded-card border border-border bg-white p-5 shadow-card">
        <h3 className="mb-3 text-sm font-bold text-ink">Today's Appointments</h3>
        {todayAppts.length === 0
          ? <p className="text-sm text-ink-secondary">No appointments today.</p>
          : todayAppts.map(a => (
            <div key={a.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
              <span className="text-sm font-medium text-ink">{a.patient}</span>
              <span className="text-xs text-ink-secondary">{a.time} · {a.reason}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Patients ──────────────────────────────────────────────────────────────────
function Patients() {
  const { user } = useAuth()
  const uid = user?.uid
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', idNumber: '', gender: '', phone: '', email: '',
    address: '', medicalAid: '', planName: '', memberNumber: '', chronicConditions: '', allergies: '', currentMedication: '',
  })

  const SA_ID_RE = /^\d{13}$/
  async function save() {
    if (!uid || !form.firstName || !form.lastName) return
    if (form.idNumber && !SA_ID_RE.test(form.idNumber)) { alert('ID number must be 13 digits'); return }
    await addDoc(collection(db, 'users', uid, 'patients'), { ...form, createdAt: serverTimestamp() })
    setOpen(false)
  }

  const cols = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'idNumber', label: 'ID Number' },
    { key: 'phone', label: 'Phone' },
    { key: 'medicalAid', label: 'Medical Aid' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'users', uid, 'patients', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Patients</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> Add Patient
        </button>
      </div>
      <DataTable columns={cols} data={patients} emptyMessage="No patients yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Patient" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name *" value={form.firstName} onChange={e => setForm(f=>({...f,firstName:e.target.value}))} />
          <Field label="Last Name *" value={form.lastName} onChange={e => setForm(f=>({...f,lastName:e.target.value}))} />
          <Field label="Date of Birth" type="date" value={form.dob} onChange={e => setForm(f=>({...f,dob:e.target.value}))} />
          <Field label="SA ID Number (13 digits)" value={form.idNumber} onChange={e => setForm(f=>({...f,idNumber:e.target.value}))} />
          <Field label="Gender" select value={form.gender} onChange={e => setForm(f=>({...f,gender:e.target.value}))}>
            <option value="">Select…</option>
            {['Male','Female','Non-binary','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
          </Field>
          <Field label="Phone" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
          <Field label="Email" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
          <Field label="Address" value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} />
          <Field label="Medical Aid Name" value={form.medicalAid} onChange={e => setForm(f=>({...f,medicalAid:e.target.value}))} />
          <Field label="Plan Name" value={form.planName} onChange={e => setForm(f=>({...f,planName:e.target.value}))} />
          <Field label="Member Number" value={form.memberNumber} onChange={e => setForm(f=>({...f,memberNumber:e.target.value}))} />
          <div className="col-span-2">
            <Field label="Chronic Conditions / ICD-10 Codes" textarea value={form.chronicConditions} onChange={e => setForm(f=>({...f,chronicConditions:e.target.value}))} />
          </div>
          <div className="col-span-2">
            <Field label="Allergies" textarea value={form.allergies} onChange={e => setForm(f=>({...f,allergies:e.target.value}))} />
          </div>
          <div className="col-span-2">
            <Field label="Current Medication" textarea value={form.currentMedication} onChange={e => setForm(f=>({...f,currentMedication:e.target.value}))} />
          </div>
        </div>
        <button onClick={save} className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Patient</button>
      </Modal>
    </div>
  )
}

// ── Consultations ─────────────────────────────────────────────────────────────
function Consultations() {
  const { user } = useAuth()
  const uid = user?.uid
  const consultations = useCollection(uid ? `users/${uid}/consultations` : null)
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ patientId: '', date: '', subjective: '', objective: '', assessment: '', plan: '', icd10: '' })
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const storageRef = ref(storage, `consultations/${uid}/${Date.now()}/audio.webm`)
      await uploadBytes(storageRef, blob)
      const audioUrl = await getDownloadURL(storageRef)
      setForm(f => ({ ...f, audioUrl }))
      // Trigger transcription via Cloud Function
      try {
        const transcribeFn = httpsCallable(functions, 'transcribeConsultation')
        const result = await transcribeFn({ storagePath: storageRef.fullPath })
        setTranscript(result.data?.transcript ?? '')
      } catch { setTranscript('Transcription unavailable — check Cloud Functions.') }
    }
    mr.start()
    mediaRecorderRef.current = mr
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function save() {
    if (!uid) return
    const patient = patients.find(p => p.id === form.patientId)
    await addDoc(collection(db, 'users', uid, 'consultations'), {
      ...form, patient: patient ? `${patient.firstName} ${patient.lastName}` : '',
      transcript, createdAt: serverTimestamp(),
    })
    setOpen(false); setTranscript('')
  }

  const cols = [
    { key: 'patient', label: 'Patient' },
    { key: 'date', label: 'Date' },
    { key: 'assessment', label: 'Assessment' },
    { key: 'icd10', label: 'ICD-10' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Consultations</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Consultation
        </button>
      </div>
      <DataTable columns={cols} data={consultations} emptyMessage="No consultations yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Consultation" size="lg">
        <div className="space-y-4">
          <Field label="Patient" select value={form.patientId} onChange={e => setForm(f=>({...f,patientId:e.target.value}))}>
            <option value="">Select patient…</option>
            {patients.map(p=><option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </Field>
          <Field label="Date" type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
          <div className="flex items-center gap-3">
            <button onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${recording ? 'bg-red-500 text-white' : 'border border-border text-ink-secondary hover:border-primary'}`}>
              {recording ? <><Square size={14} /> Stop Recording</> : <><Mic size={14} /> Record Consultation</>}
            </button>
            {transcript && <span className="text-xs text-green-600 font-semibold">Transcript ready ✓</span>}
          </div>
          {transcript && (
            <div className="rounded-xl bg-surface-2 p-3 text-xs text-ink-secondary max-h-24 overflow-y-auto">{transcript}</div>
          )}
          <Field label="Subjective (patient complaint)" textarea value={form.subjective} onChange={e => setForm(f=>({...f,subjective:e.target.value}))} />
          <Field label="Objective (findings)" textarea value={form.objective} onChange={e => setForm(f=>({...f,objective:e.target.value}))} />
          <Field label="Assessment (diagnosis)" value={form.assessment} onChange={e => setForm(f=>({...f,assessment:e.target.value}))} />
          <Field label="ICD-10 Code" placeholder="e.g. J06.9" value={form.icd10} onChange={e => setForm(f=>({...f,icd10:e.target.value}))} />
          <Field label="Plan" textarea value={form.plan} onChange={e => setForm(f=>({...f,plan:e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Consultation</button>
        </div>
      </Modal>
    </div>
  )
}

function SimplePage({ title }) {
  return <div><h2 className="text-base font-bold text-ink mb-3">{title}</h2><p className="text-sm text-ink-secondary">This section is being built.</p></div>
}

export default function MedicalDashboard() {
  return (
    <DashboardLayout industry="medical" pageTitle="Medical & Health">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="patients" element={<Patients />} />
        <Route path="consultations" element={<Consultations />} />
        <Route path="profile" element={<ProfilePage industry="medical" />} />
        <Route path="popia" element={<PopiaModule />} />
        <Route path="*" element={<SimplePage title="Coming Soon" />} />
      </Routes>
    </DashboardLayout>
  )
}
