import React, { useState, useRef, useMemo } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import SetupChecklist from '../../shared/SetupChecklist'
import CampaignSnapshot from '../../shared/CampaignSnapshot'
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, functions } from '../../../services/firebase'
import { httpsCallable } from 'firebase/functions'
import {
  PlusCircle, Trash2, Mic, Square, Plus, Play, Pause, Search, X, Loader2, FileText, Bell,
  Download, Mail, Pencil, Eye, Save as SaveIcon, Link2, Copy, Check,
  User, UserCircle, Calendar, Stethoscope, Activity, Pill, ClipboardList,
  Heart, Thermometer, Droplet, Wind, Gauge, Scale, AlertTriangle, Phone,
  CreditCard, Users, Clock, ChevronLeft, ChevronRight, LayoutList, CalendarDays,
} from 'lucide-react'
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CampaignsModule from '../../shared/CampaignsModule'
import AutomationsModule from '../../shared/AutomationsModule'
import PopiaModule from '../../shared/PopiaModule'
import SurveysModule from '../../shared/SurveysModule'
import SettingsPage from '../../shared/SettingsPage'
import { fmtDate } from '../../../utils/dates'

/* ────────────────────────────────────────────────────────────────────────────
   PDF generation (shared) — uses @react-pdf/renderer's pdf() to build a Blob
   on demand, so we can both download it and email it as a base64 attachment.
──────────────────────────────────────────────────────────────────────────── */
const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#0F172A', lineHeight: 1.5 },
  header: { borderBottom: '2 solid #5B8E7D', paddingBottom: 10, marginBottom: 16 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#5B8E7D' },
  practiceLine: { fontSize: 9, color: '#64748B', marginTop: 2 },
  docTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  metaItem: { width: '50%', marginBottom: 4 },
  label: { fontSize: 8, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 10 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#5B8E7D', marginTop: 10, marginBottom: 3, textTransform: 'uppercase' },
  para: { marginBottom: 6 },
  rxLine: { marginBottom: 2 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: '1 solid #E2E8F0', paddingTop: 8, fontSize: 8, color: '#94A3B8' },
  signBlock: { marginTop: 36, borderTop: '1 solid #94A3B8', width: 220, paddingTop: 4 },
  logo: { width: 44, height: 44, objectFit: 'contain', marginRight: 10 },
})

function PdfMeta({ items }) {
  return (
    <View style={pdfStyles.metaRow}>
      {items.filter(i => i.value).map((i, idx) => (
        <View key={idx} style={pdfStyles.metaItem}>
          <Text style={pdfStyles.label}>{i.label}</Text>
          <Text style={pdfStyles.value}>{i.value}</Text>
        </View>
      ))}
    </View>
  )
}

function PdfSection({ title, body }) {
  if (!body) return null
  return (
    <View>
      <Text style={pdfStyles.sectionTitle}>{title}</Text>
      <Text style={pdfStyles.para}>{body}</Text>
    </View>
  )
}

function PdfHeader({ practice, title }) {
  return (
    <View style={pdfStyles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        {practice?.logoUrl ? <Image src={practice.logoUrl} style={pdfStyles.logo} /> : null}
        <View>
          <Text style={pdfStyles.brand}>{practice?.name || 'Tlhiso'}</Text>
          {practice?.line ? <Text style={pdfStyles.practiceLine}>{practice.line}</Text> : null}
        </View>
      </View>
      <Text style={pdfStyles.docTitle}>{title}</Text>
    </View>
  )
}

function PdfSignature({ practitioner }) {
  return (
    <View style={pdfStyles.signBlock}>
      <Text style={pdfStyles.value}>{practitioner || ''}</Text>
      <Text style={pdfStyles.label}>Practitioner signature &amp; date</Text>
    </View>
  )
}

// Consultation PDF
function ConsultationPDF({ c, practice }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader practice={practice} title="Consultation Record" />
        <PdfMeta items={[
          { label: 'Patient', value: c.patient },
          { label: 'Date', value: c.date },
          { label: 'Practitioner', value: c.practitioner },
          { label: 'Chief Complaint', value: c.chiefComplaint },
        ]} />
        {(c.bp || c.pulse || c.temp || c.spo2 || c.glucose || c.bmi) && (
          <View>
            <Text style={pdfStyles.sectionTitle}>Vitals</Text>
            <Text style={pdfStyles.para}>
              {[c.bp && `BP ${c.bp}`, c.pulse && `Pulse ${c.pulse}`, c.temp && `Temp ${c.temp}°C`,
                c.resp && `RR ${c.resp}`, c.spo2 && `SpO2 ${c.spo2}%`, c.glucose && `Glucose ${c.glucose}`,
                c.weight && `Wt ${c.weight}kg`, c.height && `Ht ${c.height}cm`, c.bmi && `BMI ${c.bmi}`]
                .filter(Boolean).join('   ·   ')}
            </Text>
          </View>
        )}
        <PdfSection title="Subjective" body={c.subjective} />
        <PdfSection title="Objective" body={c.objective} />
        <PdfSection title="Assessment" body={c.assessment} />
        <PdfSection title="Plan" body={c.plan} />
        {Array.isArray(c.icd10) && c.icd10.length > 0 && (
          <View>
            <Text style={pdfStyles.sectionTitle}>Diagnosis (ICD-10)</Text>
            {c.icd10.map((d, i) => <Text key={i} style={pdfStyles.rxLine}>{d.code} — {d.desc}</Text>)}
          </View>
        )}
        {c.prescription?.length > 0 && (
          <View>
            <Text style={pdfStyles.sectionTitle}>Prescription</Text>
            {c.prescription.map((r, i) => <Text key={i} style={pdfStyles.rxLine}>• {r.drug} {r.dosage} {r.frequency} {r.duration}</Text>)}
          </View>
        )}
        {c.transcript ? <PdfSection title="Transcript" body={c.transcript} /> : null}
        {c.followUpDate ? <PdfSection title="Follow-up" body={`${c.followUpDate} ${c.followUpNotes || ''}`} /> : null}
        <PdfSignature practitioner={c.practitioner} />
        <Text style={pdfStyles.footer} fixed>
          {practice?.name || 'Tlhiso'} · This is a confidential medical document (POPIA). Generated via Tlhiso.
        </Text>
      </Page>
    </Document>
  )
}

// Medical Report PDF
function ReportPDF({ r, practice }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader practice={practice} title={r.reportType || 'Medical Report'} />
        <PdfMeta items={[
          { label: 'Patient', value: r.patient },
          { label: 'ID Number', value: r.patientIdNumber },
          { label: 'Date', value: r.date },
          { label: 'Practitioner', value: r.practitioner },
          { label: 'Addressed To', value: r.recipient },
        ]} />
        <PdfSection title="Diagnosis" body={r.diagnosis} />
        {r.icd10 ? <PdfSection title="ICD-10 Code(s)" body={r.icd10} /> : null}
        <PdfSection title="Relevant History" body={r.history} />
        <PdfSection title="Clinical Findings" body={r.clinicalFindings} />
        <PdfSection title="Treatment / Management" body={r.treatment} />
        <PdfSection title="Prognosis" body={r.prognosis} />
        {r.fitForWork ? (
          <PdfSection title="Fitness / Booking Off"
            body={`${r.fitForWork}${r.daysBookedOff ? ` · ${r.daysBookedOff} day(s)` : ''}${r.fromDate ? ` (${r.fromDate} to ${r.toDate})` : ''}`} />
        ) : null}
        <PdfSection title="Recommendations" body={r.recommendations} />
        <PdfSignature practitioner={r.practitioner} />
        <Text style={pdfStyles.footer} fixed>
          {practice?.name || 'Tlhiso'} · Confidential — released with patient consent (POPIA). Generated via Tlhiso.
        </Text>
      </Page>
    </Document>
  )
}

// Referral letter PDF
function ReferralPDF({ r, practice }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader practice={practice} title="Referral Letter" />
        <PdfMeta items={[
          { label: 'Date', value: r.date },
          { label: 'Urgency', value: r.urgency },
          { label: 'Patient', value: r.patient },
          { label: 'ID Number', value: r.patientIdNumber },
          { label: 'Referring Practitioner', value: r.referringPractitioner },
          { label: 'Status', value: r.status },
        ]} />
        <PdfSection title="Referred To"
          body={`${r.specialist || ''}${r.specialistDiscipline ? ` (${r.specialistDiscipline})` : ''}${r.specialistPractice ? `\n${r.specialistPractice}` : ''}${r.specialistContact ? `\n${r.specialistContact}` : ''}`} />
        <PdfSection title="Reason for Referral" body={r.reason} />
        {r.icd10 ? <PdfSection title="ICD-10 Code(s)" body={r.icd10} /> : null}
        <PdfSection title="Clinical Summary / History" body={r.clinicalSummary} />
        <PdfSection title="Relevant Investigations / Results" body={r.investigations} />
        <PdfSection title="Current Medication" body={r.currentMedication} />
        {(r.medicalAid || r.authNumber) && (
          <PdfSection title="Medical Aid & Authorisation"
            body={`${r.medicalAid || ''}${r.authNumber ? `\nPre-Authorisation No.: ${r.authNumber}` : ''}`} />
        )}
        <PdfSignature practitioner={r.referringPractitioner} />
        <Text style={pdfStyles.footer} fixed>
          {practice?.name || 'Tlhiso'} · Confidential — shared with patient consent (POPIA). Generated via Tlhiso.
        </Text>
      </Page>
    </Document>
  )
}

// Build a Blob from a PDF document element
async function pdfToBlob(element) {
  return await pdf(element).toBlob()
}

// Trigger a browser download of a Blob
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Blob → base64 (no data: prefix) for SendGrid attachment
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}


/* ────────────────────────────────────────────────────────────────────────────
   Bundled common ICD-10 codes (SA primary-care + specialist mix).
   Extend this array freely — the picker searches both code and description.
──────────────────────────────────────────────────────────────────────────── */
const ICD10_CODES = [
  { code: 'A09',   desc: 'Infectious gastroenteritis & colitis, unspecified' },
  { code: 'A15.0', desc: 'Tuberculosis of lung, confirmed' },
  { code: 'B20',   desc: 'HIV disease resulting in infectious/parasitic disease' },
  { code: 'B24',   desc: 'Unspecified HIV disease' },
  { code: 'B34.9', desc: 'Viral infection, unspecified' },
  { code: 'B54',   desc: 'Unspecified malaria' },
  { code: 'C50.9', desc: 'Malignant neoplasm of breast, unspecified' },
  { code: 'C61',   desc: 'Malignant neoplasm of prostate' },
  { code: 'C18.9', desc: 'Malignant neoplasm of colon, unspecified' },
  { code: 'D12.6', desc: 'Benign neoplasm of colon, unspecified' },
  { code: 'D50.9', desc: 'Iron deficiency anaemia, unspecified' },
  { code: 'D64.9', desc: 'Anaemia, unspecified' },
  { code: 'E03.9', desc: 'Hypothyroidism, unspecified' },
  { code: 'E05.9', desc: 'Thyrotoxicosis, unspecified' },
  { code: 'E10.9', desc: 'Type 1 diabetes mellitus without complications' },
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65',desc: 'Type 2 diabetes mellitus with hyperglycaemia' },
  { code: 'E66.9', desc: 'Obesity, unspecified' },
  { code: 'E78.5', desc: 'Hyperlipidaemia, unspecified' },
  { code: 'E86',   desc: 'Volume depletion (dehydration)' },
  { code: 'F32.9', desc: 'Depressive episode, unspecified' },
  { code: 'F41.1', desc: 'Generalised anxiety disorder' },
  { code: 'F41.9', desc: 'Anxiety disorder, unspecified' },
  { code: 'F10.2', desc: 'Alcohol dependence' },
  { code: 'F90.9', desc: 'ADHD, unspecified type' },
  { code: 'G43.9', desc: 'Migraine, unspecified' },
  { code: 'G40.9', desc: 'Epilepsy, unspecified' },
  { code: 'G47.0', desc: 'Insomnia' },
  { code: 'H10.9', desc: 'Conjunctivitis, unspecified' },
  { code: 'H52.4', desc: 'Presbyopia' },
  { code: 'H66.9', desc: 'Otitis media, unspecified' },
  { code: 'H81.1', desc: 'Benign paroxysmal vertigo' },
  { code: 'I10',   desc: 'Essential (primary) hypertension' },
  { code: 'I20.9', desc: 'Angina pectoris, unspecified' },
  { code: 'I21.9', desc: 'Acute myocardial infarction, unspecified' },
  { code: 'I25.9', desc: 'Chronic ischaemic heart disease, unspecified' },
  { code: 'I48.91',desc: 'Atrial fibrillation, unspecified' },
  { code: 'I50.9', desc: 'Heart failure, unspecified' },
  { code: 'I63.9', desc: 'Cerebral infarction, unspecified (stroke)' },
  { code: 'I83.9', desc: 'Varicose veins of lower extremities' },
  { code: 'J00',   desc: 'Acute nasopharyngitis (common cold)' },
  { code: 'J02.9', desc: 'Acute pharyngitis, unspecified' },
  { code: 'J03.9', desc: 'Acute tonsillitis, unspecified' },
  { code: 'J06.9', desc: 'Acute upper respiratory infection, unspecified' },
  { code: 'J18.9', desc: 'Pneumonia, unspecified organism' },
  { code: 'J20.9', desc: 'Acute bronchitis, unspecified' },
  { code: 'J30.9', desc: 'Allergic rhinitis, unspecified' },
  { code: 'J44.9', desc: 'COPD, unspecified' },
  { code: 'J45.9', desc: 'Asthma, unspecified' },
  { code: 'K21.9', desc: 'GORD without oesophagitis' },
  { code: 'K29.7', desc: 'Gastritis, unspecified' },
  { code: 'K30',   desc: 'Functional dyspepsia' },
  { code: 'K52.9', desc: 'Noninfective gastroenteritis & colitis' },
  { code: 'K59.0', desc: 'Constipation' },
  { code: 'K80.2', desc: 'Calculus of gallbladder without cholecystitis' },
  { code: 'L20.9', desc: 'Atopic dermatitis, unspecified' },
  { code: 'L23.9', desc: 'Allergic contact dermatitis' },
  { code: 'L30.9', desc: 'Dermatitis, unspecified' },
  { code: 'L40.9', desc: 'Psoriasis, unspecified' },
  { code: 'L70.0', desc: 'Acne vulgaris' },
  { code: 'M16.9', desc: 'Osteoarthritis of hip, unspecified' },
  { code: 'M17.9', desc: 'Osteoarthritis of knee, unspecified' },
  { code: 'M25.5', desc: 'Pain in joint' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'M54.2', desc: 'Cervicalgia (neck pain)' },
  { code: 'M79.7', desc: 'Fibromyalgia' },
  { code: 'M81.0', desc: 'Postmenopausal osteoporosis' },
  { code: 'N18.9', desc: 'Chronic kidney disease, unspecified' },
  { code: 'N39.0', desc: 'Urinary tract infection, site not specified' },
  { code: 'N40',   desc: 'Benign prostatic hyperplasia' },
  { code: 'N95.1', desc: 'Menopausal & perimenopausal symptoms' },
  { code: 'O80',   desc: 'Single spontaneous delivery' },
  { code: 'Z34.9', desc: 'Supervision of normal pregnancy, unspecified' },
  { code: 'R05',   desc: 'Cough' },
  { code: 'R07.4', desc: 'Chest pain, unspecified' },
  { code: 'R10.4', desc: 'Abdominal pain, unspecified' },
  { code: 'R11.0', desc: 'Nausea' },
  { code: 'R42',   desc: 'Dizziness and giddiness' },
  { code: 'R50.9', desc: 'Fever, unspecified' },
  { code: 'R51',   desc: 'Headache' },
  { code: 'R53.83',desc: 'Fatigue' },
  { code: 'S06.0', desc: 'Concussion' },
  { code: 'S52.5', desc: 'Fracture of lower end of radius' },
  { code: 'S93.4', desc: 'Sprain of ankle' },
  { code: 'T78.4', desc: 'Allergy, unspecified' },
  { code: 'Z00.0', desc: 'General adult medical examination' },
  { code: 'Z23',   desc: 'Encounter for immunisation' },
  { code: 'Z76.0', desc: 'Encounter for repeat prescription' },
]

function Field({ label, error, textarea, select, children, hint, ...props }) {
  const cls = 'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {textarea ? <textarea {...props} className={cls + ' resize-none h-24'} /> :
       select ? <select {...props} className={cls}>{children}</select> :
       <input {...props} className={cls} />}
      {hint && <span className="mt-1 block text-[11px] text-slate-600/70">{hint}</span>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

function SectionTitle({ children }) {
  return (
    <div className="col-span-2 mt-2 flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/* searchable multi-select ICD-10 picker */
function Icd10Picker({ selected, onChange }) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return ICD10_CODES.slice(0, 8)
    return ICD10_CODES.filter(c =>
      c.code.toLowerCase().includes(term) || c.desc.toLowerCase().includes(term)
    ).slice(0, 12)
  }, [q])

  const has = code => selected.some(s => s.code === code)
  const toggle = item => {
    if (has(item.code)) onChange(selected.filter(s => s.code !== item.code))
    else onChange([...selected, item])
  }

  return (
    <div className="col-span-2">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">Diagnosis — ICD-10 Codes</span>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map(s => (
            <span key={s.code} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {s.code} — {s.desc}
              <button type="button" onClick={() => toggle(s)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-600" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code or condition (e.g. E11, hypertension)…"
          className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">
        {results.length === 0 && <p className="px-3 py-2 text-xs text-slate-600">No matches. Type a different term.</p>}
        {results.map(item => (
          <button key={item.code} type="button" onClick={() => toggle(item)}
            className={`flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50 ${has(item.code) ? 'bg-primary/10/50' : ''}`}>
            <span><span className="font-bold text-slate-800">{item.code}</span> <span className="text-slate-600">{item.desc}</span></span>
            {has(item.code) ? <X size={13} className="text-primary" /> : <Plus size={13} className="text-slate-600" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const consultations = useCollection(uid ? `users/${uid}/consultations` : null)
  const referrals = useCollection(uid ? `users/${uid}/referrals` : null)

  const today = new Date().toISOString().slice(0, 10)
  const todayAppts = appointments.filter(a => a.date === today)

  const weekStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10)
  }, [])
  const thisWeekConsultations = consultations.filter(c => c.date >= weekStart)
  const pendingReferrals = referrals.filter(r => !r.status || r.status === 'Pending' || r.status === 'Sent')

  const thisMonth = new Date().toISOString().slice(0, 7)
  const newPatientsThisMonth = patients.filter(p => {
    const created = p.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 7)
    return created === thisMonth
  }).length

  const apptChartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({
        day: d.toLocaleDateString('en-ZA', { weekday: 'short' }),
        count: appointments.filter(a => a.date === dateStr).length,
      })
    }
    return days
  }, [appointments])

  const upcoming = useMemo(() => {
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7)
    return appointments
      .filter(a => a.date > today && a.date <= nextWeek.toISOString().slice(0, 10))
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 5)
  }, [appointments, today])

  const recentConsults = useMemo(() =>
    [...consultations]
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, 5),
    [consultations]
  )

  return (
    <div className="space-y-6">
      <SetupChecklist industry="medical" />
      <div>
        <h2 className="text-lg font-bold text-slate-800">{`Welcome back${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`}</h2>
        <p className="mt-0.5 text-sm text-slate-600">Your practice at a glance.</p>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Patients" value={patients.length} icon="🫀"
          trend={newPatientsThisMonth ? `+${newPatientsThisMonth} this month` : undefined} trendTone="up" />
        <StatCard label="Today's Appointments" value={todayAppts.length} icon="📅" color="blue" />
        <StatCard label="Consultations This Week" value={thisWeekConsultations.length} icon="🩺" color="purple" />
        <StatCard label="Pending Referrals" value={pendingReferrals.length} icon="📋" color="orange" />
      </div>

      {/* Campaign snapshot */}
      <CampaignSnapshot industry="medical" />

      {/* Chart + Today's schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-bold text-slate-800">Appointments — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apptChartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} cursor={{ fill: '#F1F5F9' }} />
              <Bar dataKey="count" name="Appointments" fill="#5B8E7D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Today's Schedule</h3>
          {todayAppts.length === 0
            ? <p className="text-sm text-slate-600">No appointments today.</p>
            : <div className="space-y-2">
                {[...todayAppts].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(a => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <div className="flex h-8 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {a.time || '—'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{a.patient}</p>
                      <p className="truncate text-xs text-slate-600">{a.reason || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Recent consultations + Upcoming appointments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Recent Consultations</h3>
          {recentConsults.length === 0
            ? <p className="text-sm text-slate-600">No consultations recorded yet.</p>
            : recentConsults.map(c => (
                <div key={c.id} className="flex items-center justify-between border-b border-slate-200 py-2.5 last:border-0">
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.patient}</p>
                    <p className="truncate text-xs text-slate-600">{c.chiefComplaint || '—'}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-600">{c.date || '—'}</span>
                </div>
              ))
          }
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Upcoming Appointments</h3>
          {upcoming.length === 0
            ? <p className="text-sm text-slate-600">No appointments in the next 7 days.</p>
            : upcoming.map(a => (
                <div key={a.id} className="flex items-center justify-between border-b border-slate-200 py-2.5 last:border-0">
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.patient}</p>
                    <p className="truncate text-xs text-slate-600">{a.reason || '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-primary">{fmtDate(a.date)}</p>
                    {a.time && <p className="text-xs text-slate-600">{a.time}</p>}
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Patients ──────────────────────────────────────────────────────────────────
const BLANK = {
  firstName: '', lastName: '', dob: '', idNumber: '', gender: '', race: '', homeLanguage: '', maritalStatus: '',
  phone: '', email: '', address: '',
  nextOfKinName: '', nextOfKinRelationship: '', nextOfKinPhone: '',
  medicalAid: '', planName: '', memberNumber: '', principalMember: '', dependantCode: '',
  bloodType: '', notes: '',
}

const emptyDependant = () => ({ name: '', dob: '', relationship: '', dependantCode: '' })
const emptyAllergy = () => ({ allergen: '', reaction: '', severity: '' })
const emptyCondition = () => ({ condition: '', icd10: '' })
const emptyMedication = () => ({ name: '', dosage: '', frequency: '' })
const emptySurgery = () => ({ procedure: '', date: '', notes: '' })

function Patients() {
  const { user } = useAuth()
  const uid = user?.uid
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [dependants, setDependants] = useState([])
  const [allergies, setAllergies] = useState([])
  const [conditions, setConditions] = useState([])
  const [medications, setMedications] = useState([])
  const [surgeries, setSurgeries] = useState([])
  const [saving, setSaving] = useState(false)
  const [shareOpen,  setShareOpen]  = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareBusy,  setShareBusy]  = useState(false)
  const [shareSent,  setShareSent]  = useState(false)
  const [copied,     setCopied]     = useState(false)

  const intakeLink = uid ? `${window.location.origin}/intake/${uid}` : ''

  async function emailIntakeLink() {
    if (!shareEmail || !shareEmail.includes('@')) { alert('Enter a valid email address.'); return }
    setShareBusy(true)
    try {
      const fn = httpsCallable(functions, 'sendEmail')
      await fn({
        to: shareEmail,
        subject: 'Please complete your patient intake form',
        htmlBody: `<p>Dear Patient,</p>
<p>Please click the link below to complete your patient intake form before your appointment:</p>
<p><a href="${intakeLink}" style="color:#0d9488;font-weight:bold;">Complete Patient Intake Form</a></p>
<p>This form collects your personal and medical details securely. Your information is protected under POPIA.</p>
<p>If you have any questions, please contact our practice directly.</p>
<br/><p>Kind regards,<br/>The Practice Team · Powered by Tlhiso</p>`,
      })
      await addDoc(collection(db, 'users', uid, 'messages'), {
        to: shareEmail, type: 'email',
        subject: 'Patient intake form link',
        body: intakeLink, module: 'patient-intake', status: 'sent', sentAt: serverTimestamp(),
      })
      setShareSent(true)
      setShareEmail('')
      setTimeout(() => setShareSent(false), 4000)
    } catch { alert('Failed to send email. Check SendGrid credentials.') }
    finally { setShareBusy(false) }
  }

  function copyLink() {
    navigator.clipboard.writeText(intakeLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const SA_ID_RE = /^\d{13}$/

  function resetAll() {
    setForm(BLANK); setDependants([]); setAllergies([]); setConditions([])
    setMedications([]); setSurgeries([])
  }

  function openEdit(r) {
    setEditing(r)
    setForm({ firstName: r.firstName||'', lastName: r.lastName||'', dob: r.dob||'', idNumber: r.idNumber||'', gender: r.gender||'', race: r.race||'', homeLanguage: r.homeLanguage||'', maritalStatus: r.maritalStatus||'', phone: r.phone||'', email: r.email||'', address: r.address||'', nextOfKinName: r.nextOfKinName||'', nextOfKinRelationship: r.nextOfKinRelationship||'', nextOfKinPhone: r.nextOfKinPhone||'', medicalAid: r.medicalAid||'', planName: r.planName||'', memberNumber: r.memberNumber||'', principalMember: r.principalMember||'', dependantCode: r.dependantCode||'', bloodType: r.bloodType||'', notes: r.notes||'' })
    setDependants(r.dependants ? [...r.dependants] : [])
    setAllergies(r.allergies ? [...r.allergies] : [])
    setConditions(r.chronicConditions ? [...r.chronicConditions] : [])
    setMedications(r.currentMedication ? [...r.currentMedication] : [])
    setSurgeries(r.surgicalHistory ? [...r.surgicalHistory] : [])
  }

  const updateRow = (list, setList) => (i, key, val) =>
    setList(list.map((row, idx) => idx === i ? { ...row, [key]: val } : row))
  const removeRow = (list, setList) => i => setList(list.filter((_, idx) => idx !== i))

  async function save() {
    if (!uid || !form.firstName || !form.lastName) { alert('First and last name are required'); return }
    if (form.idNumber && !SA_ID_RE.test(form.idNumber)) { alert('SA ID number must be exactly 13 digits'); return }
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', uid, 'patients'), {
        ...form,
        dependants: dependants.filter(d => d.name),
        allergies: allergies.filter(a => a.allergen),
        chronicConditions: conditions.filter(c => c.condition),
        currentMedication: medications.filter(m => m.name),
        surgicalHistory: surgeries.filter(s => s.procedure),
        tags: [],
        createdAt: serverTimestamp(),
      })
      setOpen(false); resetAll()
    } finally { setSaving(false) }
  }

  async function saveEdit() {
    if (!uid || !form.firstName || !form.lastName || !editing) { alert('First and last name are required'); return }
    if (form.idNumber && !SA_ID_RE.test(form.idNumber)) { alert('SA ID number must be exactly 13 digits'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', uid, 'patients', editing.id), {
        ...form,
        dependants: dependants.filter(d => d.name),
        allergies: allergies.filter(a => a.allergen),
        chronicConditions: conditions.filter(c => c.condition),
        currentMedication: medications.filter(m => m.name),
        surgicalHistory: surgeries.filter(s => s.procedure),
      })
      setEditing(null); resetAll()
    } finally { setSaving(false) }
  }

  const cols = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'idNumber', label: 'ID Number' },
    { key: 'phone', label: 'Phone' },
    { key: 'medicalAid', label: 'Medical Aid' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); setViewing(r) }}
          title="View" className="rounded p-1 text-slate-600 hover:bg-slate-50"><Eye size={14} /></button>
        <button onClick={e => { e.stopPropagation(); openEdit(r) }}
          title="Edit" className="rounded p-1 text-primary hover:bg-primary/10"><Pencil size={14} /></button>
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this patient? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'patients', r.id)) }}
          title="Delete" className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  const AddBtn = ({ onClick, children }) => (
    <button type="button" onClick={onClick}
      className="col-span-2 flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
      <Plus size={13} /> {children}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Patients</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShareOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition">
            <Link2 size={15} /> Share Intake Form
          </button>
          <button onClick={() => { resetAll(); setOpen(true) }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
            <PlusCircle size={15} /> Add Patient
          </button>
        </div>
      </div>
      <DataTable columns={cols} data={patients} emptyMessage="No patients yet." onRowClick={setViewing} />

      {/* Share intake form modal */}
      <Modal open={shareOpen} onClose={() => { setShareOpen(false); setShareEmail(''); setShareSent(false) }} title="Share Patient Intake Form">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Send patients this link to fill in their details before their appointment. Submissions appear instantly in your Patients list.
          </p>

          {/* Link display + copy */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Form link</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-xs text-slate-800">{intakeLink}</span>
              <button onClick={copyLink}
                className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition">
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
          </div>

          {/* Email the link */}
          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">Email link to patient</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                placeholder="patient@email.com"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button onClick={emailIntakeLink} disabled={shareBusy || !shareEmail}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-50 transition">
                {shareBusy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send
              </button>
            </div>
            {shareSent && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-600">
                <Check size={12} /> Link emailed successfully
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="New Patient" size="xl">
        <div className="space-y-4">
          <ReferralFormSection title="Personal Details" icon={User}>
            <Field label="First Name *" value={form.firstName} onChange={set('firstName')} />
            <Field label="Last Name *" value={form.lastName} onChange={set('lastName')} />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} />
            <Field label="SA ID Number (13 digits)" value={form.idNumber} onChange={set('idNumber')} maxLength={13} />
            <Field label="Gender" select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {['Male','Female','Non-binary','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
            </Field>
            <Field label="Marital Status" select value={form.maritalStatus} onChange={set('maritalStatus')}>
              <option value="">Select…</option>
              {['Single','Married','Divorced','Widowed'].map(g=><option key={g}>{g}</option>)}
            </Field>
            <Field label="Race (optional — clinical history)" select value={form.race} onChange={set('race')}>
              <option value="">Select…</option>
              {['African','Coloured','Indian','White','Other','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
            </Field>
            <Field label="Home Language" value={form.homeLanguage} onChange={set('homeLanguage')} />
            <Field label="Blood Type" select value={form.bloodType} onChange={set('bloodType')}>
              <option value="">Unknown</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g}>{g}</option>)}
            </Field>
          </ReferralFormSection>

          <ReferralFormSection title="Contact & Next of Kin" icon={Phone}>
            <Field label="Phone (+27…)" value={form.phone} onChange={set('phone')} />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} />
            <div className="col-span-2"><Field label="Physical Address" textarea value={form.address} onChange={set('address')} /></div>
            <Field label="Next of Kin Name" value={form.nextOfKinName} onChange={set('nextOfKinName')} />
            <Field label="Next of Kin Relationship" value={form.nextOfKinRelationship} onChange={set('nextOfKinRelationship')} />
            <Field label="Next of Kin Phone" value={form.nextOfKinPhone} onChange={set('nextOfKinPhone')} />
          </ReferralFormSection>

          <ReferralFormSection title="Medical Aid" icon={CreditCard}>
            <Field label="Medical Aid Name" value={form.medicalAid} onChange={set('medicalAid')} />
            <Field label="Plan / Option" value={form.planName} onChange={set('planName')} />
            <Field label="Member Number" value={form.memberNumber} onChange={set('memberNumber')} />
            <Field label="Principal Member Name" value={form.principalMember} onChange={set('principalMember')} />
            <Field label="Dependant Code" value={form.dependantCode} onChange={set('dependantCode')} />
          </ReferralFormSection>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Users size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Dependants</h4>
            </div>
            <div className="space-y-2 p-4">
              {dependants.map((d, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-4"><Field label="Name" value={d.name} onChange={e => updateRow(dependants,setDependants)(i,'name',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="DOB" type="date" value={d.dob} onChange={e => updateRow(dependants,setDependants)(i,'dob',e.target.value)} /></div>
                  <div className="col-span-2"><Field label="Relationship" value={d.relationship} onChange={e => updateRow(dependants,setDependants)(i,'relationship',e.target.value)} /></div>
                  <div className="col-span-2"><Field label="Dep. Code" value={d.dependantCode} onChange={e => updateRow(dependants,setDependants)(i,'dependantCode',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(dependants,setDependants)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setDependants([...dependants, emptyDependant()])}>Add Dependant</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Activity size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Chronic Conditions (ICD-10)</h4>
            </div>
            <div className="space-y-2 p-4">
              {conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-7"><Field label="Condition" value={c.condition} onChange={e => updateRow(conditions,setConditions)(i,'condition',e.target.value)} /></div>
                  <div className="col-span-4"><Field label="ICD-10 Code" placeholder="e.g. E11.9" value={c.icd10} onChange={e => updateRow(conditions,setConditions)(i,'icd10',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(conditions,setConditions)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setConditions([...conditions, emptyCondition()])}>Add Condition</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Pill size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Chronic & Current Medication</h4>
            </div>
            <div className="space-y-2 p-4">
              {medications.map((m, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-5"><Field label="Medication" value={m.name} onChange={e => updateRow(medications,setMedications)(i,'name',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Dosage" placeholder="e.g. 500mg" value={m.dosage} onChange={e => updateRow(medications,setMedications)(i,'dosage',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Frequency" placeholder="e.g. twice daily" value={m.frequency} onChange={e => updateRow(medications,setMedications)(i,'frequency',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(medications,setMedications)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setMedications([...medications, emptyMedication()])}>Add Medication</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><AlertTriangle size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Allergies</h4>
            </div>
            <div className="space-y-2 p-4">
              {allergies.map((a, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-4"><Field label="Allergen" value={a.allergen} onChange={e => updateRow(allergies,setAllergies)(i,'allergen',e.target.value)} /></div>
                  <div className="col-span-4"><Field label="Reaction" value={a.reaction} onChange={e => updateRow(allergies,setAllergies)(i,'reaction',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Severity" select value={a.severity} onChange={e => updateRow(allergies,setAllergies)(i,'severity',e.target.value)}>
                    <option value="">Select…</option>{['Mild','Moderate','Severe','Anaphylaxis'].map(s=><option key={s}>{s}</option>)}
                  </Field></div>
                  <button type="button" onClick={() => removeRow(allergies,setAllergies)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setAllergies([...allergies, emptyAllergy()])}>Add Allergy</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardList size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Surgical History</h4>
            </div>
            <div className="space-y-2 p-4">
              {surgeries.map((s, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-5"><Field label="Procedure" value={s.procedure} onChange={e => updateRow(surgeries,setSurgeries)(i,'procedure',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Date" type="date" value={s.date} onChange={e => updateRow(surgeries,setSurgeries)(i,'date',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Notes" value={s.notes} onChange={e => updateRow(surgeries,setSurgeries)(i,'notes',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(surgeries,setSurgeries)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setSurgeries([...surgeries, emptySurgery()])}>Add Surgery</AddBtn>
            </div>
          </div>

          <ReferralFormSection title="Additional Notes" icon={FileText}>
            <div className="col-span-2"><Field label="Clinical Notes" textarea value={form.notes} onChange={set('notes')} /></div>
          </ReferralFormSection>
        </div>

        <button onClick={save} disabled={saving} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Patient'}
        </button>
      </Modal>

      {/* Edit patient modal */}
      <Modal open={!!editing} onClose={() => { setEditing(null); resetAll() }} title="Edit Patient" size="xl">
        <div className="space-y-4">
          <ReferralFormSection title="Personal Details" icon={User}>
            <Field label="First Name *" value={form.firstName} onChange={set('firstName')} />
            <Field label="Last Name *" value={form.lastName} onChange={set('lastName')} />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} />
            <Field label="SA ID Number (13 digits)" value={form.idNumber} onChange={set('idNumber')} maxLength={13} />
            <Field label="Gender" select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {['Male','Female','Non-binary','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
            </Field>
            <Field label="Marital Status" select value={form.maritalStatus} onChange={set('maritalStatus')}>
              <option value="">Select…</option>
              {['Single','Married','Divorced','Widowed'].map(g=><option key={g}>{g}</option>)}
            </Field>
            <Field label="Race (optional — clinical history)" select value={form.race} onChange={set('race')}>
              <option value="">Select…</option>
              {['African','Coloured','Indian','White','Other','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
            </Field>
            <Field label="Home Language" value={form.homeLanguage} onChange={set('homeLanguage')} />
            <Field label="Blood Type" select value={form.bloodType} onChange={set('bloodType')}>
              <option value="">Unknown</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g}>{g}</option>)}
            </Field>
          </ReferralFormSection>

          <ReferralFormSection title="Contact & Next of Kin" icon={Phone}>
            <Field label="Phone (+27…)" value={form.phone} onChange={set('phone')} />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} />
            <div className="col-span-2"><Field label="Physical Address" textarea value={form.address} onChange={set('address')} /></div>
            <Field label="Next of Kin Name" value={form.nextOfKinName} onChange={set('nextOfKinName')} />
            <Field label="Next of Kin Relationship" value={form.nextOfKinRelationship} onChange={set('nextOfKinRelationship')} />
            <Field label="Next of Kin Phone" value={form.nextOfKinPhone} onChange={set('nextOfKinPhone')} />
          </ReferralFormSection>

          <ReferralFormSection title="Medical Aid" icon={CreditCard}>
            <Field label="Medical Aid Name" value={form.medicalAid} onChange={set('medicalAid')} />
            <Field label="Plan / Option" value={form.planName} onChange={set('planName')} />
            <Field label="Member Number" value={form.memberNumber} onChange={set('memberNumber')} />
            <Field label="Principal Member Name" value={form.principalMember} onChange={set('principalMember')} />
            <Field label="Dependant Code" value={form.dependantCode} onChange={set('dependantCode')} />
          </ReferralFormSection>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Users size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Dependants</h4>
            </div>
            <div className="space-y-2 p-4">
              {dependants.map((d, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-4"><Field label="Name" value={d.name} onChange={e => updateRow(dependants,setDependants)(i,'name',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="DOB" type="date" value={d.dob} onChange={e => updateRow(dependants,setDependants)(i,'dob',e.target.value)} /></div>
                  <div className="col-span-2"><Field label="Relationship" value={d.relationship} onChange={e => updateRow(dependants,setDependants)(i,'relationship',e.target.value)} /></div>
                  <div className="col-span-2"><Field label="Dep. Code" value={d.dependantCode} onChange={e => updateRow(dependants,setDependants)(i,'dependantCode',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(dependants,setDependants)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setDependants([...dependants, emptyDependant()])}>Add Dependant</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Activity size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Chronic Conditions (ICD-10)</h4>
            </div>
            <div className="space-y-2 p-4">
              {conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-7"><Field label="Condition" value={c.condition} onChange={e => updateRow(conditions,setConditions)(i,'condition',e.target.value)} /></div>
                  <div className="col-span-4"><Field label="ICD-10 Code" placeholder="e.g. E11.9" value={c.icd10} onChange={e => updateRow(conditions,setConditions)(i,'icd10',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(conditions,setConditions)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setConditions([...conditions, emptyCondition()])}>Add Condition</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Pill size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Chronic & Current Medication</h4>
            </div>
            <div className="space-y-2 p-4">
              {medications.map((m, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-5"><Field label="Medication" value={m.name} onChange={e => updateRow(medications,setMedications)(i,'name',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Dosage" placeholder="e.g. 500mg" value={m.dosage} onChange={e => updateRow(medications,setMedications)(i,'dosage',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Frequency" placeholder="e.g. twice daily" value={m.frequency} onChange={e => updateRow(medications,setMedications)(i,'frequency',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(medications,setMedications)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setMedications([...medications, emptyMedication()])}>Add Medication</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><AlertTriangle size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Allergies</h4>
            </div>
            <div className="space-y-2 p-4">
              {allergies.map((a, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-4"><Field label="Allergen" value={a.allergen} onChange={e => updateRow(allergies,setAllergies)(i,'allergen',e.target.value)} /></div>
                  <div className="col-span-4"><Field label="Reaction" value={a.reaction} onChange={e => updateRow(allergies,setAllergies)(i,'reaction',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Severity" select value={a.severity} onChange={e => updateRow(allergies,setAllergies)(i,'severity',e.target.value)}>
                    <option value="">Select…</option>{['Mild','Moderate','Severe','Anaphylaxis'].map(s=><option key={s}>{s}</option>)}
                  </Field></div>
                  <button type="button" onClick={() => removeRow(allergies,setAllergies)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setAllergies([...allergies, emptyAllergy()])}>Add Allergy</AddBtn>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardList size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Surgical History</h4>
            </div>
            <div className="space-y-2 p-4">
              {surgeries.map((s, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-5"><Field label="Procedure" value={s.procedure} onChange={e => updateRow(surgeries,setSurgeries)(i,'procedure',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Date" type="date" value={s.date} onChange={e => updateRow(surgeries,setSurgeries)(i,'date',e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Notes" value={s.notes} onChange={e => updateRow(surgeries,setSurgeries)(i,'notes',e.target.value)} /></div>
                  <button type="button" onClick={() => removeRow(surgeries,setSurgeries)(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <AddBtn onClick={() => setSurgeries([...surgeries, emptySurgery()])}>Add Surgery</AddBtn>
            </div>
          </div>

          <ReferralFormSection title="Additional Notes" icon={FileText}>
            <div className="col-span-2"><Field label="Clinical Notes" textarea value={form.notes} onChange={set('notes')} /></div>
          </ReferralFormSection>
        </div>
        <button onClick={saveEdit} disabled={saving} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </Modal>

      {/* Patient detail view */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Patient Record" size="xl">
        {viewing && (
          <div className="text-sm">
            <div className="-mx-6 -mt-2 mb-4 border-b border-slate-200 bg-gradient-to-r from-primary-light/60 to-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
                    {initials(`${viewing.firstName || ''} ${viewing.lastName || ''}`.trim())}
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight text-slate-800">{`${viewing.firstName || ''} ${viewing.lastName || ''}`.trim() || '—'}</h3>
                    <p className="text-xs text-slate-600">{[viewing.gender, viewing.dob && `DOB ${fmtDate(viewing.dob)}`].filter(Boolean).join(' · ') || 'Patient'}</p>
                  </div>
                </div>
                {viewing.bloodType && <StatusPill label={`Blood ${viewing.bloodType}`} tone="red" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-xs">
                {viewing.idNumber && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">ID Number</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.idNumber}</p>
                  </div>
                )}
                {viewing.phone && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Phone</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.phone}</p>
                  </div>
                )}
                {viewing.email && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Email</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.email}</p>
                  </div>
                )}
                {viewing.medicalAid && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Medical Aid</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.medicalAid}</p>
                  </div>
                )}
              </div>
            </div>

            {Array.isArray(viewing.allergies) && viewing.allergies.length > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">Allergies</p>
                  <p className="text-sm text-slate-800">{viewing.allergies.map(a => `${a.allergen}${a.severity ? ` (${a.severity})` : ''}`).join(', ')}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><User size={13} /></span>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Personal & Contact</h4>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/70">
                  <ReferralField label="Home Language" value={viewing.homeLanguage} />
                  <ReferralField label="Marital Status" value={viewing.maritalStatus} />
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/70 border-t border-slate-200/70">
                  <ReferralField label="Race" value={viewing.race} />
                  <ReferralField label="Phone" value={viewing.phone} />
                </div>
                {viewing.address && (
                  <div className="border-t border-slate-200/70">
                    <ReferralField label="Physical Address" value={viewing.address} full />
                  </div>
                )}
              </div>

              {(viewing.nextOfKinName || viewing.nextOfKinPhone) && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Users size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Next of Kin</h4>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/70">
                    <ReferralField label="Name" value={viewing.nextOfKinName} />
                    <ReferralField label="Relationship" value={viewing.nextOfKinRelationship} />
                  </div>
                  <div className="border-t border-slate-200/70">
                    <ReferralField label="Phone" value={viewing.nextOfKinPhone} full />
                  </div>
                </div>
              )}

              {(viewing.medicalAid || viewing.memberNumber) && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><CreditCard size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Medical Aid</h4>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/70">
                    <ReferralField label="Scheme" value={viewing.medicalAid} />
                    <ReferralField label="Plan / Option" value={viewing.planName} />
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/70 border-t border-slate-200/70">
                    <ReferralField label="Member Number" value={viewing.memberNumber} />
                    <ReferralField label="Principal Member" value={viewing.principalMember} />
                  </div>
                  {viewing.dependantCode && (
                    <div className="border-t border-slate-200/70">
                      <ReferralField label="Dependant Code" value={viewing.dependantCode} full />
                    </div>
                  )}
                </div>
              )}

              {Array.isArray(viewing.dependants) && viewing.dependants.length > 0 && (
                <RecordViewSection title="Dependants" icon={Users}>
                  <div className="space-y-1.5">
                    {viewing.dependants.map((d, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-sm font-medium text-slate-800">{d.name}</span>
                        <span className="text-xs text-slate-600">{[d.relationship, d.dob, d.dependantCode].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                </RecordViewSection>
              )}

              {Array.isArray(viewing.chronicConditions) && viewing.chronicConditions.length > 0 && (
                <RecordViewSection title="Chronic Conditions" icon={Activity}>
                  <Chips items={viewing.chronicConditions.map(c => `${c.condition}${c.icd10 ? ` (${c.icd10})` : ''}`)} />
                </RecordViewSection>
              )}

              {Array.isArray(viewing.currentMedication) && viewing.currentMedication.length > 0 && (
                <RecordViewSection title="Current Medication" icon={Pill}>
                  <div className="space-y-1.5">
                    {viewing.currentMedication.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <Pill size={13} className="shrink-0 text-primary" />
                        <span className="text-sm text-slate-800"><span className="font-semibold">{m.name}</span> {m.dosage} · {m.frequency}</span>
                      </div>
                    ))}
                  </div>
                </RecordViewSection>
              )}

              {Array.isArray(viewing.surgicalHistory) && viewing.surgicalHistory.length > 0 && (
                <RecordViewSection title="Surgical History" icon={ClipboardList}>
                  <div className="space-y-1.5">
                    {viewing.surgicalHistory.map((s, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-sm font-medium text-slate-800">{s.procedure}</span>
                        <span className="text-xs text-slate-600">{[s.date, s.notes].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                </RecordViewSection>
              )}

              {viewing.notes && (
                <RecordViewSection title="Clinical Notes" icon={FileText}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{viewing.notes}</p>
                </RecordViewSection>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Consultations ─────────────────────────────────────────────────────────────
const emptyRx = () => ({ drug: '', dosage: '', frequency: '', duration: '' })

const CONSULT_BLANK = {
  patientId: '', date: new Date().toISOString().slice(0, 10), practitioner: '',
  chiefComplaint: '',
  bp: '', pulse: '', temp: '', resp: '', spo2: '', weight: '', height: '', bmi: '', glucose: '',
  subjective: '', objective: '', assessment: '', plan: '',
  followUpDate: '', followUpNotes: '',
}

function Consultations() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const consultations = useCollection(uid ? `users/${uid}/consultations` : null)
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const practitioners = useCollection(uid ? `users/${uid}/practitioners` : null)

  const practice = {
    name: profile?.businessName || profile?.name || 'Tlhiso',
    logoUrl: profile?.businessLogoUrl || '',
    line: [profile?.practiceNumber && `Practice No. ${profile.practiceNumber}`, profile?.phone, profile?.email].filter(Boolean).join('  ·  '),
  }

  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [downloadingId, setDownloadingId] = useState(false)

  function openView(row) { setViewing(row); setEditing(false); setEditForm(null) }
  function startEdit() {
    setEditForm({
      ...viewing,
      prescription: viewing.prescription ? [...viewing.prescription] : [],
      icd10: Array.isArray(viewing.icd10) ? [...viewing.icd10] : [],
    })
    setEditing(true)
  }
  const setE = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))

  async function saveEdit() {
    if (!uid || !editForm) return
    setSavingEdit(true)
    try {
      const { id, createdAt, ...payload } = editForm
      payload.icd10Summary = (Array.isArray(payload.icd10) ? payload.icd10 : []).map(c => c.code).join(', ')
      await updateDoc(doc(db, 'users', uid, 'consultations', id), payload)
      setViewing({ ...editForm }); setEditing(false)
    } finally { setSavingEdit(false) }
  }

  async function downloadPdf(c) {
    setDownloadingId(true)
    try {
      const blob = await pdfToBlob(<ConsultationPDF c={c} practice={practice} />)
      downloadBlob(blob, `consultation-${(c.patient || 'patient').replace(/\s+/g, '_')}-${c.date || ''}.pdf`)
    } catch {
      alert('Could not generate the PDF.')
    } finally { setDownloadingId(false) }
  }
  const [form, setForm] = useState(CONSULT_BLANK)
  const [icd, setIcd] = useState([])
  const [rx, setRx] = useState([])
  const [saving, setSaving] = useState(false)

  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioPath, setAudioPath] = useState('')
  const [playing, setPlaying] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [recError, setRecError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioElRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  function setWeight(e) {
    const weight = e.target.value
    setForm(f => {
      const h = parseFloat(f.height) / 100
      const bmi = weight && h ? (parseFloat(weight) / (h * h)).toFixed(1) : ''
      return { ...f, weight, bmi }
    })
  }
  function setHeight(e) {
    const height = e.target.value
    setForm(f => {
      const h = parseFloat(height) / 100
      const bmi = f.weight && h ? (parseFloat(f.weight) / (h * h)).toFixed(1) : ''
      return { ...f, height, bmi }
    })
  }

  function resetAll() {
    setForm(CONSULT_BLANK); setIcd([]); setRx([]); setTranscript('')
    setAudioUrl(''); setAudioPath(''); setPlaying(false); setRecError(''); setElapsed(0)
  }

  // Pick a mimeType the browser actually supports (fixes Safari/iOS + some Chrome builds)
  function pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return null
    const candidates = [
      'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus',
      'audio/mp4', 'audio/mpeg', '',
    ]
    for (const t of candidates) {
      if (t === '' || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t))) return t
    }
    return null
  }

  async function startRecording() {
    setRecError('')
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setRecError('Audio recording is not supported in this browser. Try Chrome or Edge.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []

      mr.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onerror = () => setRecError('Recording error — please try again.')
      mr.onstop = async () => {
        try {
          streamRef.current?.getTracks().forEach(t => t.stop())
          clearInterval(timerRef.current)
          const type = mr.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type })
          if (blob.size === 0) { setRecError('No audio captured. Check your microphone and try again.'); return }
          setAudioUrl(URL.createObjectURL(blob))
          // upload to Firebase Storage
          setUploadingAudio(true)
          const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm'
          const storageRef = ref(storage, `consultations/${uid}/${Date.now()}/audio.${ext}`)
          await uploadBytes(storageRef, blob, { contentType: type })
          setAudioPath(storageRef.fullPath)
        } catch (err) {
          console.error('[storage] audio upload failed', err)
          setRecError(`Storage upload failed: ${err?.code || err?.message || 'unknown error'}. Run: firebase deploy --only storage`)
        } finally {
          setUploadingAudio(false)
        }
      }

      // timeslice ensures ondataavailable fires periodically (more robust across browsers)
      mr.start(1000)
      mediaRecorderRef.current = mr
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      setRecording(true)
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setRecError('Microphone access was denied. Allow microphone access in your browser and reload.')
      } else if (err?.name === 'NotFoundError') {
        setRecError('No microphone was found on this device.')
      } else {
        setRecError('Could not start recording. Note: recording requires HTTPS (or localhost).')
      }
    }
  }

  function stopRecording() {
    try { mediaRecorderRef.current?.stop() } catch { /* noop */ }
    clearInterval(timerRef.current)
    setRecording(false)
  }

  function togglePlay() {
    const el = audioElRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else { el.play(); setPlaying(true) }
  }

  async function runTranscription() {
    if (!audioPath) { alert('Record audio first.'); return }
    setTranscribing(true)
    try {
      const fn = httpsCallable(functions, 'transcribeConsultation')
      const res = await fn({ storagePath: audioPath })
      if (res.data?.success === false) {
        setTranscript(`Transcription failed: ${res.data.error || 'Unknown error'}`)
      } else {
        setTranscript(res.data?.transcript ?? '')
      }
    } catch (e) {
      setTranscript(`Transcription failed: ${e?.message || 'Unknown error'}`)
    } finally { setTranscribing(false) }
  }

  const updateRx = (i, key, val) => setRx(rx.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  const removeRx = i => setRx(rx.filter((_, idx) => idx !== i))

  async function save() {
    if (!uid) return
    if (!form.patientId) { alert('Please select a patient.'); return }
    setSaving(true)
    try {
      const patient = patients.find(p => p.id === form.patientId)
      await addDoc(collection(db, 'users', uid, 'consultations'), {
        ...form,
        patient: patient ? `${patient.firstName} ${patient.lastName}` : '',
        icd10: icd,
        icd10Summary: icd.map(c => c.code).join(', '),
        prescription: rx.filter(r => r.drug),
        audioPath, transcript,
        createdAt: serverTimestamp(),
      })
      setOpen(false); resetAll()
    } finally { setSaving(false) }
  }

  const cols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'patient', label: 'Patient' },
    { key: 'practitioner', label: 'Practitioner' },
    { key: 'chiefComplaint', label: 'Complaint' },
    { key: 'icd10Summary', label: 'ICD-10' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this consultation? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'consultations', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Consultations</h2>
        <button onClick={() => { resetAll(); setOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Consultation
        </button>
      </div>

      <DataTable columns={cols} data={consultations} emptyMessage="No consultations yet." onRowClick={openView} />

      {/* New consultation */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Consultation" size="xl">
        <div className="space-y-4">
          <ReferralFormSection title="Encounter" icon={Stethoscope}>
            <Field label="Patient *" select value={form.patientId} onChange={set('patientId')}>
              <option value="">Select patient…</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </Field>
            <Field label="Practitioner" select value={form.practitioner} onChange={set('practitioner')}>
              <option value="">Select…</option>
              {practitioners.map(p => <option key={p.id} value={p.name}>{p.name}{p.speciality ? ` — ${p.speciality}` : ''}</option>)}
            </Field>
            <Field label="Date" type="date" value={form.date} onChange={set('date')} />
            <Field label="Chief Complaint" value={form.chiefComplaint} onChange={set('chiefComplaint')} placeholder="Reason for visit" />
          </ReferralFormSection>

          <ReferralFormSection title="Vitals" icon={Activity}>
            <Field label="Blood Pressure (mmHg)" value={form.bp} onChange={set('bp')} placeholder="120/80" />
            <Field label="Pulse (bpm)" value={form.pulse} onChange={set('pulse')} />
            <Field label="Temperature (°C)" value={form.temp} onChange={set('temp')} />
            <Field label="Respiratory Rate" value={form.resp} onChange={set('resp')} />
            <Field label="SpO₂ (%)" value={form.spo2} onChange={set('spo2')} />
            <Field label="Blood Glucose (mmol/L)" value={form.glucose} onChange={set('glucose')} />
            <Field label="Weight (kg)" value={form.weight} onChange={setWeight} />
            <Field label="Height (cm)" value={form.height} onChange={setHeight} />
            <Field label="BMI (auto)" value={form.bmi} readOnly hint="Calculated from weight & height" />
          </ReferralFormSection>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Mic size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Voice Note & Transcription</h4>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={recording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${recording ? 'bg-red-500 text-white animate-pulse' : 'border border-slate-200 text-slate-600 hover:border-primary'}`}>
                  {recording ? <><Square size={14} /> Stop</> : <><Mic size={14} /> Record</>}
                </button>
                {recording && (
                  <span className="text-xs font-semibold text-red-500">
                    ● Recording… {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                  </span>
                )}
                {uploadingAudio && <span className="flex items-center gap-1 text-xs text-slate-600"><Loader2 size={13} className="animate-spin" /> Saving audio…</span>}
                {audioUrl && !recording && (
                  <>
                    <audio ref={audioElRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
                    <button type="button" onClick={togglePlay}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-primary">
                      {playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
                    </button>
                    <button type="button" onClick={runTranscription} disabled={transcribing || uploadingAudio}
                      className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {transcribing ? <><Loader2 size={14} className="animate-spin" /> Transcribing…</> : <><FileText size={14} /> Transcribe</>}
                    </button>
                  </>
                )}
              </div>
              {recError && <p className="mt-2 text-xs font-medium text-red-500">{recError}</p>}
              {audioUrl && !recording && !recError && (
                <p className="mt-2 text-[11px] text-slate-600">Tip: play back to check the audio before transcribing or saving.</p>
              )}
              {transcript && (
                <div className="mt-3">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Transcript (editable)</span>
                  <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
                    className="h-28 w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
              )}
            </div>
          </div>

          <ReferralFormSection title="SOAP Notes" icon={FileText}>
            <div className="col-span-2"><Field label="Subjective — patient's reported symptoms/history" textarea value={form.subjective} onChange={set('subjective')} /></div>
            <div className="col-span-2"><Field label="Objective — exam findings, observations" textarea value={form.objective} onChange={set('objective')} /></div>
            <div className="col-span-2"><Field label="Assessment — clinical impression" textarea value={form.assessment} onChange={set('assessment')} /></div>
            <div className="col-span-2"><Field label="Plan — management, investigations, advice" textarea value={form.plan} onChange={set('plan')} /></div>
          </ReferralFormSection>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardList size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Diagnosis (ICD-10)</h4>
            </div>
            <div className="p-4"><Icd10Picker selected={icd} onChange={setIcd} /></div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Pill size={13} /></span>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Prescription</h4>
            </div>
            <div className="space-y-2 p-4">
              {rx.map((r, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-3">
                  <div className="col-span-4"><Field label="Medication" value={r.drug} onChange={e => updateRx(i, 'drug', e.target.value)} /></div>
                  <div className="col-span-3"><Field label="Dosage" value={r.dosage} onChange={e => updateRx(i, 'dosage', e.target.value)} placeholder="e.g. 500mg" /></div>
                  <div className="col-span-2"><Field label="Frequency" value={r.frequency} onChange={e => updateRx(i, 'frequency', e.target.value)} placeholder="bd" /></div>
                  <div className="col-span-2"><Field label="Duration" value={r.duration} onChange={e => updateRx(i, 'duration', e.target.value)} placeholder="7 days" /></div>
                  <button type="button" onClick={() => removeRx(i)} className="col-span-1 mb-1 rounded p-2 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setRx([...rx, emptyRx()])}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
                <Plus size={13} /> Add Medication
              </button>
            </div>
          </div>

          <ReferralFormSection title="Follow-up" icon={Calendar}>
            <Field label="Follow-up Date" type="date" value={form.followUpDate} onChange={set('followUpDate')} />
            <Field label="Follow-up Notes" value={form.followUpNotes} onChange={set('followUpNotes')} />
          </ReferralFormSection>
        </div>

        <button onClick={save} disabled={saving}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Consultation'}
        </button>
      </Modal>

      {/* View / edit consultation */}
      <Modal open={!!viewing} onClose={() => { setViewing(null); setEditing(false) }} title={editing ? 'Edit Consultation' : 'Consultation Record'} size="xl">
        {viewing && !editing && (
          <div className="text-sm">
            <div className="-mx-6 -mt-2 mb-4 border-b border-slate-200 bg-gradient-to-r from-primary-light/60 to-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
                    {initials(viewing.patient)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight text-slate-800">{viewing.patient || '—'}</h3>
                    <p className="text-xs text-slate-600">Consultation Record</p>
                  </div>
                </div>
                {viewing.followUpDate && <StatusPill label="Follow-up set" tone="primary" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-xs">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Date</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{fmtDate(viewing.date)}</p>
                </div>
                {viewing.practitioner && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Practitioner</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.practitioner}</p>
                  </div>
                )}
                {viewing.chiefComplaint && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Chief Complaint</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.chiefComplaint}</p>
                  </div>
                )}
              </div>
            </div>
            <Toolbar>
              <ToolbarBtn onClick={startEdit} icon={Pencil}>Edit</ToolbarBtn>
              <ToolbarBtn onClick={() => downloadPdf(viewing)} disabled={downloadingId} loading={downloadingId} icon={Download} primary>
                {downloadingId ? 'Generating…' : 'Download PDF'}
              </ToolbarBtn>
            </Toolbar>

            <div className="space-y-4">
              {(viewing.bp || viewing.pulse || viewing.temp || viewing.spo2 || viewing.glucose || viewing.bmi) && (
                <RecordViewSection title="Vitals" icon={Activity}>
                  <VitalsGrid vitals={[
                    { icon: Gauge, label: 'Blood Pressure', value: viewing.bp },
                    { icon: Heart, label: 'Pulse', value: viewing.pulse, unit: 'bpm' },
                    { icon: Thermometer, label: 'Temp', value: viewing.temp, unit: '°C' },
                    { icon: Wind, label: 'Resp Rate', value: viewing.resp },
                    { icon: Droplet, label: 'SpO₂', value: viewing.spo2, unit: '%' },
                    { icon: Droplet, label: 'Glucose', value: viewing.glucose },
                    { icon: Scale, label: 'Weight', value: viewing.weight, unit: 'kg' },
                    { icon: Scale, label: 'Height', value: viewing.height, unit: 'cm' },
                    { icon: Activity, label: 'BMI', value: viewing.bmi },
                  ]} />
                </RecordViewSection>
              )}

              {(viewing.subjective || viewing.objective || viewing.assessment || viewing.plan) && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">SOAP Notes</h4>
                  </div>
                  <div className="divide-y divide-border/70">
                    {viewing.subjective && <ReferralField label="Subjective" value={viewing.subjective} full />}
                    {viewing.objective && <ReferralField label="Objective" value={viewing.objective} full />}
                    {viewing.assessment && <ReferralField label="Assessment" value={viewing.assessment} full />}
                    {viewing.plan && <ReferralField label="Plan" value={viewing.plan} full />}
                  </div>
                </div>
              )}

              {Array.isArray(viewing.icd10) && viewing.icd10.length > 0 && (
                <RecordViewSection title="Diagnosis (ICD-10)" icon={ClipboardList}>
                  <Chips items={viewing.icd10.map(c => `${c.code} — ${c.desc}`)} />
                </RecordViewSection>
              )}

              {Array.isArray(viewing.prescription) && viewing.prescription.length > 0 && (
                <RecordViewSection title="Prescription" icon={Pill}>
                  <div className="space-y-1.5">
                    {viewing.prescription.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <Pill size={13} className="shrink-0 text-primary" />
                        <span className="text-sm text-slate-800"><span className="font-semibold">{r.drug}</span> {r.dosage} · {r.frequency} · {r.duration}</span>
                      </div>
                    ))}
                  </div>
                </RecordViewSection>
              )}

              {viewing.transcript && (
                <RecordViewSection title="Voice Transcript" icon={Mic}>
                  <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">{viewing.transcript}</p>
                </RecordViewSection>
              )}

              {viewing.followUpDate && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Calendar size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Follow-up</h4>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/70">
                    <ReferralField label="Date" value={fmtDate(viewing.followUpDate)} />
                    <ReferralField label="Notes" value={viewing.followUpNotes} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {viewing && editing && editForm && (
          <div className="space-y-4">
            <ReferralFormSection title="Encounter" icon={Stethoscope}>
              <Field label="Practitioner" value={editForm.practitioner} onChange={setE('practitioner')} />
              <Field label="Date" type="date" value={editForm.date} onChange={setE('date')} />
              <div className="col-span-2"><Field label="Chief Complaint" value={editForm.chiefComplaint} onChange={setE('chiefComplaint')} /></div>
            </ReferralFormSection>

            <ReferralFormSection title="Vitals" icon={Activity}>
              <Field label="Blood Pressure (mmHg)" value={editForm.bp} onChange={setE('bp')} />
              <Field label="Pulse (bpm)" value={editForm.pulse} onChange={setE('pulse')} />
              <Field label="Temperature (°C)" value={editForm.temp} onChange={setE('temp')} />
              <Field label="SpO₂ (%)" value={editForm.spo2} onChange={setE('spo2')} />
              <Field label="Blood Glucose (mmol/L)" value={editForm.glucose} onChange={setE('glucose')} />
              <Field label="BMI" value={editForm.bmi} onChange={setE('bmi')} />
            </ReferralFormSection>

            <ReferralFormSection title="SOAP Notes" icon={FileText}>
              <div className="col-span-2"><Field label="Subjective" textarea value={editForm.subjective} onChange={setE('subjective')} /></div>
              <div className="col-span-2"><Field label="Objective" textarea value={editForm.objective} onChange={setE('objective')} /></div>
              <div className="col-span-2"><Field label="Assessment" textarea value={editForm.assessment} onChange={setE('assessment')} /></div>
              <div className="col-span-2"><Field label="Plan" textarea value={editForm.plan} onChange={setE('plan')} /></div>
            </ReferralFormSection>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardList size={13} /></span>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Diagnosis (ICD-10)</h4>
              </div>
              <div className="p-4"><Icd10Picker selected={editForm.icd10 || []} onChange={v => setEditForm(f => ({ ...f, icd10: v }))} /></div>
            </div>

            <ReferralFormSection title="Voice Transcript" icon={Mic}>
              <div className="col-span-2"><Field label="Transcript" textarea value={editForm.transcript || ''} onChange={setE('transcript')} /></div>
            </ReferralFormSection>

            <ReferralFormSection title="Follow-up" icon={Calendar}>
              <Field label="Follow-up Date" type="date" value={editForm.followUpDate} onChange={setE('followUpDate')} />
              <Field label="Follow-up Notes" value={editForm.followUpNotes} onChange={setE('followUpNotes')} />
            </ReferralFormSection>

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {savingEdit ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><SaveIcon size={14} /> Save Changes</>}
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-primary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────────
   Reusable record-view presentation components (professional clinical layout)
──────────────────────────────────────────────────────────────────────────── */
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '–'
}

// Header band: avatar + identity + meta chips + optional status pill
function RecordHeader({ name, subtitle, meta = [], status, statusTone }) {
  return (
    <div className="-mx-6 -mt-2 mb-5 border-b border-slate-200 bg-gradient-to-r from-primary-light/70 to-surface-2 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-bold text-white shadow-sm">
            {initials(name)}
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight text-slate-800">{name || '—'}</h3>
            {subtitle && <p className="text-xs font-medium text-slate-600">{subtitle}</p>}
          </div>
        </div>
        {status && <StatusPill label={status} tone={statusTone} />}
      </div>
      {meta.filter(m => m.value).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {meta.filter(m => m.value).map((m, i) => {
            const Icon = m.icon
            return (
              <span key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                {Icon && <Icon size={13} className="text-primary" />}
                <span className="font-medium text-slate-800">{m.value}</span>
                {m.label && <span className="text-slate-600/70">· {m.label}</span>}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Action toolbar with primary/secondary buttons
function Toolbar({ children }) {
  return <div className="mb-5 flex flex-wrap items-center gap-2">{children}</div>
}

function ToolbarBtn({ onClick, disabled, primary, icon: Icon, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition disabled:opacity-60 ${
        primary ? 'bg-primary text-white hover:bg-[#4e7d6d]'
                : 'border border-slate-200 text-slate-600 hover:border-primary hover:text-slate-800'}`}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : Icon && <Icon size={14} />}
      {children}
    </button>
  )
}

// Titled section card with an icon
function Card({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-card ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={15} /></span>}
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h4>
        </div>
      )}
      {children}
    </div>
  )
}

// A definition row used inside cards (label left, value right, subtle divider)
function Detail({ label, value, block }) {
  if (value === undefined || value === null || value === '') return null
  if (block) {
    return (
      <div className="border-t border-slate-200/60 py-2 first:border-0 first:pt-0">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{value}</p>
      </div>
    )
  }
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-slate-200/60 py-2 first:border-0 first:pt-0">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

// Two-column grid of Detail rows
function DetailGrid({ children }) {
  return <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">{children}</div>
}

// Vitals shown as little stat tiles with icons
function VitalsGrid({ vitals }) {
  const items = vitals.filter(v => v.value)
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((v, i) => {
        const Icon = v.icon
        return (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {Icon && <Icon size={12} className="text-primary" />} {v.label}
            </div>
            <p className="mt-0.5 text-sm font-bold text-slate-800">{v.value}{v.unit ? <span className="ml-0.5 text-xs font-medium text-slate-600">{v.unit}</span> : null}</p>
          </div>
        )
      })}
    </div>
  )
}

const PILL_TONES = {
  green: 'bg-green-50 text-green-600 ring-green-600/20',
  blue: 'bg-blue-50 text-blue-600 ring-blue-600/20',
  purple: 'bg-purple-50 text-purple-600 ring-purple-600/20',
  orange: 'bg-orange-50 text-orange-600 ring-orange-600/20',
  red: 'bg-red-50 text-red-500 ring-red-500/20',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  slate: 'bg-slate-50 text-slate-600 ring-border',
}
function StatusPill({ label, tone = 'slate' }) {
  if (!label) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${PILL_TONES[tone] || PILL_TONES.slate}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

function Chips({ items }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c, i) => (
        <span key={i} className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/15">{c}</span>
      ))}
    </div>
  )
}

const URGENCY_TONE = { Routine: 'slate', Urgent: 'orange', Emergency: 'red' }
const REFERRAL_TONE = { Sent: 'blue', Acknowledged: 'purple', 'Appointment Booked': 'primary', Completed: 'green', Declined: 'red' }


// ── Practitioners ───────────────────────────────────────────────────────────────
const HPCSA_RE = /^[A-Z]{2}\s?\d{6,7}$/i   // e.g. MP 0123456 / PS 1234567
const SPECIALITIES = [
  'General Practitioner','Physician','Paediatrician','Surgeon','Orthopaedic Surgeon',
  'Obstetrician & Gynaecologist','Cardiologist','Dermatologist','Psychiatrist',
  'Anaesthetist','Radiologist','Ophthalmologist','ENT Specialist','Neurologist',
  'Urologist','Dentist','Physiotherapist','Psychologist','Optometrist','Dietitian','Other',
]
const PRAC_BLANK = {
  name: '', title: 'Dr', speciality: '', hpcsaNumber: '', practiceNumber: '',
  qualification: '', email: '', phone: '', dispensingLicence: '', room: '', active: true,
}

function Practitioners() {
  const { user } = useAuth()
  const uid = user?.uid
  const practitioners = useCollection(uid ? `users/${uid}/practitioners` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(PRAC_BLANK)
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!uid || !form.name) { alert('Practitioner name is required'); return }
    if (form.hpcsaNumber && !HPCSA_RE.test(form.hpcsaNumber.trim())) {
      alert('HPCSA number looks invalid. Expected format e.g. "MP 0123456".'); return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', uid, 'practitioners'), { ...form, createdAt: serverTimestamp() })
      setForm(PRAC_BLANK); setOpen(false)
    } finally { setSaving(false) }
  }

  const cols = [
    { key: 'name', label: 'Name', render: r => `${r.title || ''} ${r.name}`.trim() },
    { key: 'speciality', label: 'Speciality' },
    { key: 'hpcsaNumber', label: 'HPCSA No.' },
    { key: 'practiceNumber', label: 'Practice No.' },
    { key: 'phone', label: 'Phone' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this practitioner? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'practitioners', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Practitioners</h2>
        <button onClick={() => { setForm(PRAC_BLANK); setOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> Add Practitioner
        </button>
      </div>
      <DataTable columns={cols} data={practitioners} emptyMessage="No practitioners yet." />

      <Modal open={open} onClose={() => setOpen(false)} title="New Practitioner" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <SectionTitle>Practitioner Details</SectionTitle>
          <Field label="Title" select value={form.title} onChange={set('title')}>
            {['Dr','Prof','Mr','Mrs','Ms','Sr'].map(t => <option key={t}>{t}</option>)}
          </Field>
          <Field label="Full Name *" value={form.name} onChange={set('name')} />
          <Field label="Speciality" select value={form.speciality} onChange={set('speciality')}>
            <option value="">Select…</option>
            {SPECIALITIES.map(s => <option key={s}>{s}</option>)}
          </Field>
          <Field label="Qualification" value={form.qualification} onChange={set('qualification')} placeholder="e.g. MBChB (UCT)" />

          <SectionTitle>Registration (SA / HPCSA)</SectionTitle>
          <Field label="HPCSA Registration No." value={form.hpcsaNumber} onChange={set('hpcsaNumber')} placeholder="e.g. MP 0123456" hint="Health Professions Council of SA" />
          <Field label="BHF Practice No." value={form.practiceNumber} onChange={set('practiceNumber')} placeholder="e.g. 0123456" hint="Board of Healthcare Funders billing number" />
          <Field label="Dispensing Licence No." value={form.dispensingLicence} onChange={set('dispensingLicence')} hint="If licensed to dispense (Sec 22C)" />
          <Field label="Consulting Room" value={form.room} onChange={set('room')} />

          <SectionTitle>Contact</SectionTitle>
          <Field label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Phone (+27…)" value={form.phone} onChange={set('phone')} />
        </div>
        <button onClick={save} disabled={saving} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Practitioner'}
        </button>
      </Modal>
    </div>
  )
}

// ── Appointments ────────────────────────────────────────────────────────────────
const APPT_BLANK = {
  patientId: '', practitioner: '', date: new Date().toISOString().slice(0, 10),
  time: '', duration: '30', reason: '', appointmentType: 'Consultation', room: '',
  status: 'Scheduled', notes: '', reminderSent: false,
}
const APPT_TYPES  = ['Consultation','Follow-up','Procedure','Vaccination','Screening','Telehealth','Emergency']
const APPT_STATUS = ['Scheduled','Confirmed','Arrived','Completed','Cancelled','No-show']

const CAL_START = 7
const CAL_END   = 20
const SLOT_H    = 60   // px per hour — full-height column approach
const CAL_TOTAL_H = (CAL_END - CAL_START) * SLOT_H
const CAL_HOURS = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i)
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const BLOCK_COLORS = {
  Scheduled: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
  Confirmed: { bg: '#F0FDF4', border: '#16A34A', text: '#15803D' },
  Arrived:   { bg: '#FAF5FF', border: '#9333EA', text: '#7E22CE' },
  Completed: { bg: '#F0FDF4', border: '#5B8E7D', text: '#166534' },
  Cancelled: { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C' },
  'No-show': { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
}

const BADGE_COLORS = {
  Scheduled:  'bg-blue-50 text-blue-700',
  Confirmed:  'bg-green-50 text-green-700',
  Arrived:    'bg-purple-50 text-purple-700',
  Completed:  'bg-primary/10 text-primary',
  Cancelled:  'bg-red-50 text-red-600',
  'No-show':  'bg-orange-50 text-orange-600',
}

function toMins(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(ws) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(ws.getDate() + i); return d
  })
}

function fmtDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtHour(h) {
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

// Resolve overlapping appointments into side-by-side columns
function resolveOverlaps(appts) {
  const sorted = [...appts].sort((a, b) => (toMins(a.time) || 0) - (toMins(b.time) || 0))
  const cols = []
  sorted.forEach(appt => {
    const start = toMins(appt.time) || 0
    const end   = start + Number(appt.duration || 30)
    let placed  = false
    for (let ci = 0; ci < cols.length; ci++) {
      const last    = cols[ci][cols[ci].length - 1]
      const lastEnd = (toMins(last.time) || 0) + Number(last.duration || 30)
      if (start >= lastEnd) { cols[ci].push(appt); placed = true; break }
    }
    if (!placed) cols.push([appt])
  })
  const result = {}
  cols.forEach((col, ci) => col.forEach(a => { result[a.id] = { col: ci, total: cols.length } }))
  return result
}

function CalApptBlock({ appt, layout, onClick }) {
  const mins = toMins(appt.time)
  if (mins === null) return null
  const top    = (mins - CAL_START * 60) / 60 * SLOT_H
  const height = Math.max(Number(appt.duration || 30) / 60 * SLOT_H - 2, 18)
  if (top < 0 || top >= CAL_TOTAL_H) return null

  const { col = 0, total = 1 } = layout || {}
  const pct    = 100 / total
  const colors = BLOCK_COLORS[appt.status] || { bg: '#F9FAFB', border: '#9CA3AF', text: '#374151' }

  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(appt) }}
      style={{
        position: 'absolute',
        top:    top + 1,
        height,
        left:   `calc(${col * pct}% + 2px)`,
        width:  `calc(${pct}% - 4px)`,
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
      }}
      className="rounded-md px-1.5 py-0.5 text-left overflow-hidden hover:brightness-95 transition-all shadow-sm"
    >
      <p className="text-[10px] font-bold leading-tight truncate">{appt.time} — {appt.patient}</p>
      {height > 32 && <p className="text-[9px] leading-tight opacity-75 truncate">{appt.appointmentType}{appt.practitioner ? ` · ${appt.practitioner}` : ''}</p>}
    </button>
  )
}

function Appointments() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const appointments  = useCollection(uid ? `users/${uid}/appointments` : null)
  const patients      = useCollection(uid ? `users/${uid}/patients` : null)
  const practitioners = useCollection(uid ? `users/${uid}/practitioners` : null)

  const scrollRef = useRef(null)

  // Form state
  const [open,     setOpen]    = useState(false)
  const [editing,  setEditing] = useState(null)   // null = new, object = edit
  const [form,     setForm]    = useState(APPT_BLANK)
  const [sendSms,  setSendSms] = useState(false)
  const [saving,   setSaving]  = useState(false)
  const [sendingId,      setSendingId]      = useState(null)
  const [rescheduleBusy, setRescheduleBusy] = useState(null)
  const [detailAppt,     setDetailAppt]     = useState(null)

  async function acceptReschedule(appt) {
    if (!uid) return
    setRescheduleBusy(appt.id)
    try {
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), {
        date: appt.rescheduleDate, time: appt.rescheduleTime,
        status: 'Confirmed', confirmationStatus: 'confirmed',
        rescheduleDate: null, rescheduleTime: null, rescheduleNote: null,
      })
      if (appt.patientPhone) {
        try {
          const fn  = httpsCallable(functions, 'sendSMS')
          const msg = `Hi ${appt.patient}, your reschedule request has been accepted. Your new appointment is confirmed for ${fmtDate(appt.rescheduleDate)} at ${appt.rescheduleTime}.`
          await fn({ to: appt.patientPhone, message: msg })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.patientPhone, type: 'sms', body: msg,
            module: 'reschedule-accepted', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      } else if (appt.patientEmail) {
        try {
          const fn      = httpsCallable(functions, 'sendEmail')
          const subject = 'Appointment Reschedule Confirmed'
          const htmlBody = `<p>Hi ${appt.patient}, your reschedule request has been accepted. Your new appointment is confirmed for ${fmtDate(appt.rescheduleDate)} at ${appt.rescheduleTime}.</p>`
          await fn({ to: appt.patientEmail, subject, htmlBody })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.patientEmail, type: 'email', body: subject,
            module: 'reschedule-accepted', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      }
    } finally { setRescheduleBusy(null) }
  }

  async function declineReschedule(appt) {
    if (!uid) return
    setRescheduleBusy(appt.id)
    try {
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), {
        confirmationStatus: null, rescheduleDate: null, rescheduleTime: null, rescheduleNote: null,
      })
      if (appt.patientPhone) {
        try {
          const fn  = httpsCallable(functions, 'sendSMS')
          const msg = `Hi ${appt.patient}, your reschedule request could not be accommodated. Your original appointment remains on ${fmtDate(appt.date)} at ${appt.time}.`
          await fn({ to: appt.patientPhone, message: msg })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.patientPhone, type: 'sms', body: msg,
            module: 'reschedule-declined', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      } else if (appt.patientEmail) {
        try {
          const fn      = httpsCallable(functions, 'sendEmail')
          const subject = 'Appointment Reschedule Request Update'
          const htmlBody = `<p>Hi ${appt.patient}, your reschedule request could not be accommodated. Your original appointment remains on ${fmtDate(appt.date)} at ${appt.time}.</p>`
          await fn({ to: appt.patientEmail, subject, htmlBody })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.patientEmail, type: 'email', body: subject,
            module: 'reschedule-declined', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      }
    } finally { setRescheduleBusy(null) }
  }
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  // Calendar state
  const todayStr = useMemo(() => fmtDateStr(new Date()), [])
  const [calView,  setCalView]  = useState('week')
  const [mainView, setMainView] = useState('calendar')
  const [anchor,   setAnchor]   = useState(() => getWeekStart(new Date()))

  const days = useMemo(() =>
    calView === 'week' ? getWeekDays(anchor) : [anchor],
    [calView, anchor]
  )

  // Scroll to current time on mount
  useMemo(() => {
    setTimeout(() => {
      if (!scrollRef.current) return
      const now = new Date()
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const top = (nowMins - CAL_START * 60) / 60 * SLOT_H - 100
      scrollRef.current.scrollTop = Math.max(0, top)
    }, 100)
  }, [mainView])

  function openNew(ds, hour) {
    setEditing(null)
    const patient = null
    setSendSms(false)
    setForm({ ...APPT_BLANK, date: ds || todayStr, time: hour ? `${String(hour).padStart(2,'0')}:00` : '' })
    setOpen(true)
  }

  function openEdit(appt) {
    setEditing(appt)
    const patient = patients.find(p => `${p.firstName} ${p.lastName}` === appt.patient)
    setSendSms(false)
    setForm({
      patientId: patient?.id || '', practitioner: appt.practitioner || '',
      date: appt.date || '', time: appt.time || '', duration: appt.duration || '30',
      reason: appt.reason || '', appointmentType: appt.appointmentType || 'Consultation',
      room: appt.room || '', status: appt.status || 'Scheduled', notes: appt.notes || '',
      reminderSent: appt.reminderSent || false,
    })
    setDetailAppt(null)
    setOpen(true)
  }

  function navPrev() {
    const d = new Date(anchor); d.setDate(d.getDate() - (calView === 'week' ? 7 : 1)); setAnchor(d)
  }
  function navNext() {
    const d = new Date(anchor); d.setDate(d.getDate() + (calView === 'week' ? 7 : 1)); setAnchor(d)
  }
  function goToday() {
    if (calView === 'week') { setAnchor(getWeekStart(new Date())) }
    else { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d) }
  }
  function switchCalView(v) {
    setCalView(v)
    if (v === 'day') { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d) }
    else { setAnchor(getWeekStart(new Date())) }
  }

  const TZ_JB = { timeZone: 'Africa/Johannesburg' }
  const rangeLabel = useMemo(() => {
    if (calView === 'day') return anchor.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...TZ_JB })
    const ws = days[0]; const we = days[6]
    return ws.getMonth() === we.getMonth()
      ? `${ws.getDate()}–${we.getDate()} ${ws.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', ...TZ_JB })}`
      : `${ws.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', ...TZ_JB })} – ${we.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', ...TZ_JB })}`
  }, [calView, anchor, days])

  const apptsByDate = useMemo(() => {
    const map = {}
    appointments.forEach(a => { if (!map[a.date]) map[a.date] = []; map[a.date].push(a) })
    return map
  }, [appointments])

  const todayAppts = (apptsByDate[todayStr] || []).length
  const scheduled  = appointments.filter(a => a.status === 'Scheduled' || a.status === 'Confirmed').length

  // Now indicator
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const nowTop  = (nowMins - CAL_START * 60) / 60 * SLOT_H
  const showNow = nowTop >= 0 && nowTop < CAL_TOTAL_H

  async function sendSmsConfirmation(patient, apptData, isEdit, apptId) {
    if (!patient?.phone) return
    try {
      const fn   = httpsCallable(functions, 'sendSMS')
      const link = apptId ? ` Confirm, cancel or reschedule: https://tlhiso.com/appt/${uid}/${apptId}` : ''
      const msg = isEdit
        ? `Hi ${patient.firstName}, your appointment on ${fmtDate(apptData.date)} at ${apptData.time}${apptData.practitioner ? ` with ${apptData.practitioner}` : ''} has been updated.${link}`
        : `Hi ${patient.firstName}, your appointment has been booked for ${fmtDate(apptData.date)} at ${apptData.time}${apptData.practitioner ? ` with ${apptData.practitioner}` : ''}.${link}`
      await fn({ to: patient.phone, message: msg })
      await addDoc(collection(db, 'users', uid, 'messages'), {
        to: patient.phone, type: 'sms', body: msg,
        module: isEdit ? 'appointment-updated' : 'appointment-confirmed',
        status: 'sent', sentAt: serverTimestamp(),
      })
    } catch { /* SMS failure is non-blocking */ }
  }

  async function save() {
    if (!uid || !form.patientId || !form.date || !form.time) { alert('Patient, date and time are required.'); return }
    setSaving(true)
    try {
      const patient = patients.find(p => p.id === form.patientId)
      const payload = {
        ...form,
        patient: patient ? `${patient.firstName} ${patient.lastName}` : '',
        patientPhone: patient?.phone || '',
        patientEmail: patient?.email || '',
        ownerPhone: profile?.phone || '',
        ownerEmail: user?.email || '',
      }
      let apptId = editing?.id
      if (editing) {
        await updateDoc(doc(db, 'users', uid, 'appointments', editing.id), payload)
      } else {
        const docRef = await addDoc(collection(db, 'users', uid, 'appointments'), { ...payload, createdAt: serverTimestamp() })
        apptId = docRef.id
      }
      if (sendSms && patient) await sendSmsConfirmation(patient, payload, !!editing, apptId)
      setOpen(false); setForm(APPT_BLANK); setEditing(null); setSendSms(false)
    } finally { setSaving(false) }
  }

  async function setApptStatus(appt, status) {
    await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { status })
    if (detailAppt?.id === appt.id) setDetailAppt(prev => ({ ...prev, status }))
    if (status === 'Completed' && profile?.googleReviewLink) sendReviewRequest(appt)
  }

  async function sendReviewRequest(appt) {
    const phone = appt.patientPhone
    const email = appt.patientEmail
    if (!phone && !email) return
    const alreadySent = appt.reviewSent ||
      appointments.some(a => a.reviewSent && a.id !== appt.id && (phone ? a.patientPhone === phone : a.patientEmail === email))
    if (alreadySent) return
    const firstName = (appt.patient || 'there').split(' ')[0]
    const link = profile.googleReviewLinkShort || profile.googleReviewLink
    try {
      if (phone) {
        await httpsCallable(functions, 'sendSMS')({ to: phone, message: `Hi ${firstName}, thank you for your visit! We'd love your feedback. Please leave us a Google review: ${link}` })
      } else {
        await httpsCallable(functions, 'sendEmail')({
          to: email,
          subject: 'Thank you for your visit — please leave us a review',
          htmlBody: `<p>Hi ${firstName}, thank you for your visit! We would love your feedback.</p><p><a href="${link}">Leave a Google Review</a></p>`,
        })
      }
      await Promise.all([
        addDoc(collection(db, 'users', uid, 'messages'), {
          to: phone || email, type: phone ? 'sms' : 'email',
          body: `Review request sent to ${firstName}`,
          module: 'review-request', status: 'sent', sentAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reviewSent: true }),
      ])
    } catch { /* non-blocking */ }
  }

  async function sendReminder(appt) {
    if (!appt.patientPhone) { alert('No phone number on this patient.'); return }
    setSendingId(appt.id)
    try {
      const fn  = httpsCallable(functions, 'sendSMS')
      const link = `https://tlhiso.com/appt/${uid}/${appt.id}`
      const msg = `Reminder: ${appt.patient}, you have an appointment on ${fmtDate(appt.date)} at ${appt.time}${appt.practitioner ? ` with ${appt.practitioner}` : ''}. Confirm, cancel or reschedule: ${link}`
      await fn({ to: appt.patientPhone, message: msg })
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reminderSent: true })
      await addDoc(collection(db, 'users', uid, 'messages'), {
        to: appt.patientPhone, type: 'sms', body: msg, module: 'appointment-reminder', status: 'sent', sentAt: serverTimestamp(),
      })
    } catch { alert('Reminder failed — check BulkSMS credentials.') }
    finally { setSendingId(null) }
  }

  const cols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'time', label: 'Time' },
    { key: 'patient', label: 'Patient' },
    { key: 'practitioner', label: 'Practitioner' },
    { key: 'appointmentType', label: 'Type' },
    { key: 'status', label: 'Status', render: r => (
      <div className="space-y-1">
        <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setApptStatus(r, e.target.value) }}
          className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${BADGE_COLORS[r.status] || 'bg-slate-50 text-slate-600'}`}>
          {APPT_STATUS.map(s => <option key={s}>{s}</option>)}
        </select>
        {r.confirmationStatus && (
          r.confirmationStatus === 'reschedule-requested' ? (
            <div className="mt-1 space-y-1" onClick={e => e.stopPropagation()}>
              <span className="block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">⟳ Reschedule requested</span>
              {r.rescheduleDate && <p className="text-[10px] text-slate-600">{fmtDate(r.rescheduleDate)} {r.rescheduleTime || ''}</p>}
              {r.rescheduleNote && <p className="text-[10px] italic text-slate-600">{r.rescheduleNote}</p>}
              <div className="flex gap-1">
                <button onClick={() => acceptReschedule(r)} disabled={rescheduleBusy === r.id}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition">Accept</button>
                <button onClick={() => declineReschedule(r)} disabled={rescheduleBusy === r.id}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition">Decline</button>
              </div>
            </div>
          ) : (
            <span className={`block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.confirmationStatus === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {r.confirmationStatus === 'confirmed' ? '✓ Patient confirmed' : '✗ Patient cancelled'}
            </span>
          )
        )}
      </div>
    )},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit(r)} className="rounded p-1 text-primary hover:bg-primary/10"><Pencil size={14} /></button>
        <button onClick={() => sendReminder(r)} disabled={sendingId === r.id} className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-50">
          {sendingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
        </button>
        <button onClick={() => { if (!window.confirm('Delete this appointment? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'appointments', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  const selectedPatient = patients.find(p => p.id === form.patientId)

  return (
    <div className="space-y-4">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Appointments</h2>
          <p className="mt-0.5 text-xs text-slate-600">{todayAppts} today · {scheduled} upcoming</p>
        </div>
        <button onClick={() => openNew()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> Book Appointment
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={goToday}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition">
            Today
          </button>
          <div className="flex">
            <button onClick={navPrev} className="rounded-l-lg border border-slate-200 p-1.5 text-slate-800 hover:bg-slate-50 transition">
              <ChevronLeft size={15} />
            </button>
            <button onClick={navNext} className="rounded-r-lg border-y border-r border-slate-200 p-1.5 text-slate-800 hover:bg-slate-50 transition">
              <ChevronRight size={15} />
            </button>
          </div>
          <span className="text-sm font-semibold text-slate-800">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }].map(v => (
              <button key={v.key} onClick={() => switchCalView(v.key)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${calView === v.key ? 'bg-primary text-white' : 'bg-white text-slate-800 hover:bg-slate-50'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            <button onClick={() => setMainView('calendar')} title="Calendar"
              className={`p-2 transition ${mainView === 'calendar' ? 'bg-primary text-white' : 'bg-white text-slate-800 hover:bg-slate-50'}`}>
              <CalendarDays size={14} />
            </button>
            <button onClick={() => setMainView('list')} title="List"
              className={`p-2 border-l border-slate-200 transition ${mainView === 'list' ? 'bg-primary text-white' : 'bg-white text-slate-800 hover:bg-slate-50'}`}>
              <LayoutList size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* List view */}
      {mainView === 'list' && (
        <DataTable columns={cols} data={appointments} emptyMessage="No appointments yet." />
      )}

      {/* ── Calendar view ── */}
      {mainView === 'calendar' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm select-none">

          {/* Day header */}
          <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
            {/* GMT label */}
            <div className="w-[52px] flex-shrink-0 border-r border-slate-200 flex items-end justify-center pb-2">
              <span className="text-[9px] font-semibold text-slate-600">SAST</span>
            </div>
            {days.map((d, i) => {
              const ds      = fmtDateStr(d)
              const isToday = ds === todayStr
              const count   = (apptsByDate[ds] || []).length
              return (
                <div key={i} className={`flex-1 border-r last:border-r-0 border-slate-200 py-2 flex flex-col items-center gap-0.5 ${isToday ? 'bg-primary/10/20' : ''}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? 'text-primary' : 'text-slate-600'}`}>
                    {DAY_LABELS[i % 7]}
                  </p>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-primary text-white' : 'text-slate-800'}`}>
                    {d.getDate()}
                  </div>
                  {count > 0 && (
                    <span className={`text-[9px] font-semibold ${isToday ? 'text-primary' : 'text-slate-600'}`}>
                      {count} appt{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Scrollable timeline */}
          <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 580 }}>
            <div className="flex">

              {/* Time gutter */}
              <div className="w-[52px] flex-shrink-0 border-r border-slate-200 relative" style={{ height: CAL_TOTAL_H }}>
                {CAL_HOURS.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - CAL_START) * SLOT_H - 8, right: 6 }}>
                    <span className="text-[10px] text-slate-600/70 font-medium whitespace-nowrap">{fmtHour(h)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((d, di) => {
                const ds       = fmtDateStr(d)
                const isToday  = ds === todayStr
                const dayAppts = apptsByDate[ds] || []
                const layouts  = resolveOverlaps(dayAppts)

                return (
                  <div key={di}
                    className={`flex-1 border-r last:border-r-0 border-slate-200 relative ${isToday ? 'bg-blue-50/20' : 'bg-white'}`}
                    style={{ height: CAL_TOTAL_H }}
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const clickY = e.clientY - rect.top + e.currentTarget.parentElement.parentElement.scrollTop
                      const h = Math.floor(clickY / SLOT_H) + CAL_START
                      if (h >= CAL_START && h < CAL_END) openNew(ds, h)
                    }}
                  >
                    {/* Hour lines */}
                    {CAL_HOURS.map(h => (
                      <div key={h} style={{ position: 'absolute', top: (h - CAL_START) * SLOT_H, left: 0, right: 0 }}
                        className="border-t border-slate-200/40" />
                    ))}
                    {/* Half-hour lines */}
                    {CAL_HOURS.map(h => (
                      <div key={`${h}h`} style={{ position: 'absolute', top: (h - CAL_START) * SLOT_H + SLOT_H / 2, left: 0, right: 0 }}
                        className="border-t border-dashed border-slate-200/25" />
                    ))}

                    {/* Current time indicator — only on today's column */}
                    {isToday && showNow && (
                      <div style={{ position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 5 }}
                        className="pointer-events-none flex items-center">
                        <div className="h-[9px] w-[9px] rounded-full bg-red-500 flex-shrink-0 -ml-[5px]" />
                        <div className="h-[2px] flex-1 bg-red-500" />
                      </div>
                    )}

                    {/* Appointment blocks */}
                    {dayAppts.map(a => (
                      <CalApptBlock key={a.id} appt={a} layout={layouts[a.id]} onClick={setDetailAppt} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/60 bg-slate-50/40 px-4 py-2">
            {APPT_STATUS.map(s => {
              const c = BLOCK_COLORS[s] || { border: '#9CA3AF', text: '#374151' }
              return (
                <span key={s} className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: c.text }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, borderLeft: `3px solid ${c.border}`, backgroundColor: c.bg, display: 'inline-block' }} />
                  {s}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Book / Edit modal */}
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }} title={editing ? 'Edit Appointment' : 'Book Appointment'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <SectionTitle>Booking</SectionTitle>
          <Field label="Patient *" select value={form.patientId} onChange={set('patientId')}>
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </Field>
          <Field label="Practitioner" select value={form.practitioner} onChange={set('practitioner')}>
            <option value="">Select…</option>
            {practitioners.map(p => <option key={p.id} value={`${p.title || ''} ${p.name}`.trim()}>{p.title} {p.name}{p.speciality ? ` — ${p.speciality}` : ''}</option>)}
          </Field>
          <Field label="Date *" type="date" value={form.date} onChange={set('date')} />
          <Field label="Time *" type="time" value={form.time} onChange={set('time')} />
          <Field label="Duration" select value={form.duration} onChange={set('duration')}>
            {['15','30','45','60','90'].map(d => <option key={d} value={d}>{d} min</option>)}
          </Field>
          <Field label="Type" select value={form.appointmentType} onChange={set('appointmentType')}>
            {APPT_TYPES.map(t => <option key={t}>{t}</option>)}
          </Field>
          <Field label="Room" value={form.room} onChange={set('room')} />
          <Field label="Status" select value={form.status} onChange={set('status')}>
            {APPT_STATUS.map(s => <option key={s}>{s}</option>)}
          </Field>
          <div className="col-span-2"><Field label="Reason for Visit" value={form.reason} onChange={set('reason')} /></div>
          <div className="col-span-2"><Field label="Notes" textarea value={form.notes} onChange={set('notes')} /></div>
        </div>

        {/* SMS toggle */}
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)}
            className="h-4 w-4 accent-primary" />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Send SMS {editing ? 'update' : 'confirmation'} to patient
            </p>
            <p className="text-xs text-slate-600">
              {selectedPatient?.phone
                ? `Will send to ${selectedPatient.phone}`
                : 'Select a patient with a phone number'}
            </p>
          </div>
        </label>

        <button onClick={save} disabled={saving}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving
            ? 'Saving…'
            : editing
              ? `Save Changes${sendSms ? ' & Send SMS' : ''}`
              : `Book Appointment${sendSms ? ' & Send SMS' : ''}`}
        </button>
      </Modal>

      {/* Appointment detail popover */}
      <Modal open={!!detailAppt} onClose={() => setDetailAppt(null)} title="Appointment">
        {detailAppt && (
          <div className="space-y-4">
            {/* Header card */}
            <div className="rounded-xl px-4 py-3" style={{ backgroundColor: BLOCK_COLORS[detailAppt.status]?.bg || '#F9FAFB', borderLeft: `4px solid ${BLOCK_COLORS[detailAppt.status]?.border || '#9CA3AF'}` }}>
              <p className="font-bold text-slate-800">{detailAppt.patient}</p>
              <p className="text-sm text-slate-600 mt-0.5">
                {fmtDate(detailAppt.date)} · {detailAppt.time} · {detailAppt.duration} min
                {detailAppt.practitioner ? ` · ${detailAppt.practitioner}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Type', value: detailAppt.appointmentType },
                { label: 'Room', value: detailAppt.room || '—' },
                { label: 'Status', value: detailAppt.status },
                { label: 'SMS Reminder', value: detailAppt.reminderSent ? 'Sent ✓' : 'Not sent' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>

            {(detailAppt.reason || detailAppt.notes) && (
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 space-y-1">
                {detailAppt.reason && <p className="text-xs text-slate-800"><span className="font-semibold">Reason:</span> {detailAppt.reason}</p>}
                {detailAppt.notes  && <p className="text-xs text-slate-800"><span className="font-semibold">Notes:</span>  {detailAppt.notes}</p>}
              </div>
            )}

            {/* Quick status */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Update status</p>
              <div className="flex flex-wrap gap-1.5">
                {APPT_STATUS.map(s => (
                  <button key={s} onClick={() => setApptStatus(detailAppt, s)}
                    style={detailAppt.status === s ? { backgroundColor: BLOCK_COLORS[s]?.bg, color: BLOCK_COLORS[s]?.text, borderColor: BLOCK_COLORS[s]?.border } : {}}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${detailAppt.status === s ? 'border-current' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => openEdit(detailAppt)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition">
                <Pencil size={12} /> Edit
              </button>
              <button onClick={() => sendReminder(detailAppt)} disabled={sendingId === detailAppt.id}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition">
                {sendingId === detailAppt.id ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                Remind
              </button>
              <button onClick={() => { if (!window.confirm('Delete this appointment?')) return; deleteDoc(doc(db, 'users', uid, 'appointments', detailAppt.id)); setDetailAppt(null) }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Medical Reports ─────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  'Medical Report','Sick Note / Medical Certificate','Medical Certificate of Fitness',
  'Disability Assessment','Insurance Report','RAF (Road Accident Fund) Report',
  'Progress Report','Discharge Summary',
]
const REPORT_BLANK = {
  patientId: '', practitioner: '', reportType: 'Medical Report',
  date: new Date().toISOString().slice(0, 10),
  recipient: '', diagnosis: '', icd10: '', clinicalFindings: '',
  history: '', treatment: '', prognosis: '',
  fitForWork: '', daysBookedOff: '', fromDate: '', toDate: '',
  recommendations: '', consentObtained: false,
}

function Reports() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const reports = useCollection(uid ? `users/${uid}/reports` : null)
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const practitioners = useCollection(uid ? `users/${uid}/practitioners` : null)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState(REPORT_BLANK)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')           // 'pdf' | 'email'
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setE = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))
  const isSickNote = form.reportType.includes('Sick Note') || form.reportType.includes('Fitness')

  const practice = {
    name: profile?.businessName || profile?.name || 'Tlhiso',
    logoUrl: profile?.businessLogoUrl || '',
    line: [profile?.practiceNumber && `Practice No. ${profile.practiceNumber}`, profile?.phone, profile?.email].filter(Boolean).join('  ·  '),
  }

  function openView(row) { setViewing(row); setEditing(false); setEditForm(null) }
  function startEdit() { setEditForm({ ...viewing }); setEditing(true) }
  const editIsSickNote = editForm && (editForm.reportType?.includes('Sick Note') || editForm.reportType?.includes('Fitness'))

  async function saveEdit() {
    if (!uid || !editForm) return
    setSavingEdit(true)
    try {
      const { id, createdAt, ...payload } = editForm
      await updateDoc(doc(db, 'users', uid, 'reports', id), payload)
      setViewing({ ...editForm }); setEditing(false)
    } finally { setSavingEdit(false) }
  }

  function reportFilename(r) {
    return `${(r.reportType || 'report').replace(/[^\w]+/g, '_')}-${(r.patient || 'patient').replace(/\s+/g, '_')}-${r.date || ''}.pdf`
  }

  async function downloadPdf(r) {
    setBusy('pdf')
    try {
      const blob = await pdfToBlob(<ReportPDF r={r} practice={practice} />)
      downloadBlob(blob, reportFilename(r))
    } catch {
      alert('Could not generate the PDF.')
    } finally { setBusy('') }
  }

  function openEmail(r) {
    setEmailTo(r.recipient && r.recipient.includes('@') ? r.recipient : '')
    setEmailMsg(`Good day,\n\nPlease find attached the ${r.reportType?.toLowerCase() || 'medical report'} for ${r.patient}.\n\nKind regards,\n${r.practitioner || practice.name}`)
    setEmailOpen(true)
  }

  async function sendEmailToDoctor() {
    if (!viewing) return
    if (!emailTo || !emailTo.includes('@')) { alert('Enter a valid recipient email address.'); return }
    setBusy('email')
    try {
      const blob = await pdfToBlob(<ReportPDF r={viewing} practice={practice} />)
      const base64 = await blobToBase64(blob)
      const htmlBody = `<p>${emailMsg.replace(/\n/g, '<br/>')}</p>`
      const fn = httpsCallable(functions, 'sendEmail')
      const res = await fn({
        to: emailTo,
        subject: `${viewing.reportType || 'Medical Report'} — ${viewing.patient}`,
        htmlBody,
        attachments: [{
          content: base64,
          filename: reportFilename(viewing),
          type: 'application/pdf',
          disposition: 'attachment',
        }],
      })
      if (res.data?.success === false) throw new Error(res.data?.error || 'send failed')
      // log to messages
      await addDoc(collection(db, 'users', uid, 'messages'), {
        to: emailTo, type: 'email', subject: `${viewing.reportType} — ${viewing.patient}`,
        body: emailMsg, module: 'medical-report', status: 'sent', sentAt: serverTimestamp(),
      })
      setEmailOpen(false)
      alert('Report emailed successfully.')
    } catch {
      alert('Email failed — confirm the sendEmail Cloud Function supports attachments and SendGrid is configured.')
    } finally { setBusy('') }
  }

  async function save() {
    if (!uid) return
    if (!form.patientId) { alert('Select a patient.'); return }
    if (!form.consentObtained) { alert('POPIA: patient consent must be confirmed before generating a report.'); return }
    setSaving(true)
    try {
      const patient = patients.find(p => p.id === form.patientId)
      await addDoc(collection(db, 'users', uid, 'reports'), {
        ...form,
        patient: patient ? `${patient.firstName} ${patient.lastName}` : '',
        patientIdNumber: patient?.idNumber || '',
        createdAt: serverTimestamp(),
      })
      setForm(REPORT_BLANK); setOpen(false)
    } finally { setSaving(false) }
  }

  const cols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'patient', label: 'Patient' },
    { key: 'reportType', label: 'Type' },
    { key: 'recipient', label: 'Addressed To' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this report? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'reports', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Medical Reports</h2>
        <button onClick={() => { setForm(REPORT_BLANK); setOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Report
        </button>
      </div>
      <DataTable columns={cols} data={reports} emptyMessage="No reports yet." onRowClick={openView} />

      <Modal open={open} onClose={() => setOpen(false)} title="New Medical Report" size="xl">
        <div className="space-y-4">
          <ReferralFormSection title="Report Details" icon={FileText}>
            <Field label="Patient *" select value={form.patientId} onChange={set('patientId')}>
              <option value="">Select patient…</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </Field>
            <Field label="Report Type" select value={form.reportType} onChange={set('reportType')}>
              {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
            </Field>
            <Field label="Practitioner" select value={form.practitioner} onChange={set('practitioner')}>
              <option value="">Select…</option>
              {practitioners.map(p => <option key={p.id} value={`${p.title || ''} ${p.name}`.trim()}>{p.title} {p.name}</option>)}
            </Field>
            <Field label="Date" type="date" value={form.date} onChange={set('date')} />
            <div className="col-span-2"><Field label="Addressed To (recipient / employer / insurer)" value={form.recipient} onChange={set('recipient')} /></div>
          </ReferralFormSection>

          <ReferralFormSection title="Clinical Content" icon={ClipboardList}>
            <div className="col-span-2"><Field label="Diagnosis" value={form.diagnosis} onChange={set('diagnosis')} /></div>
            <Field label="ICD-10 Code(s)" value={form.icd10} onChange={set('icd10')} placeholder="e.g. J45.9, I10" />
            <div className="col-span-2"><Field label="Relevant History" textarea value={form.history} onChange={set('history')} /></div>
            <div className="col-span-2"><Field label="Clinical Findings" textarea value={form.clinicalFindings} onChange={set('clinicalFindings')} /></div>
            <div className="col-span-2"><Field label="Treatment / Management" textarea value={form.treatment} onChange={set('treatment')} /></div>
            <div className="col-span-2"><Field label="Prognosis" textarea value={form.prognosis} onChange={set('prognosis')} /></div>
          </ReferralFormSection>

          {isSickNote && (
            <ReferralFormSection title="Fitness / Booking Off" icon={Activity}>
              <Field label="Fit for Work?" select value={form.fitForWork} onChange={set('fitForWork')}>
                <option value="">Select…</option>
                {['Fit','Unfit','Fit with restrictions'].map(o => <option key={o}>{o}</option>)}
              </Field>
              <Field label="Days Booked Off" value={form.daysBookedOff} onChange={set('daysBookedOff')} />
              <Field label="From" type="date" value={form.fromDate} onChange={set('fromDate')} />
              <Field label="To" type="date" value={form.toDate} onChange={set('toDate')} />
            </ReferralFormSection>
          )}

          <ReferralFormSection title="Recommendations & Consent" icon={ClipboardList}>
            <div className="col-span-2"><Field label="Recommendations" textarea value={form.recommendations} onChange={set('recommendations')} /></div>
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-amber-50 px-4 py-3 text-sm text-slate-800">
              <input type="checkbox" checked={form.consentObtained} onChange={e => setForm(f => ({ ...f, consentObtained: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-200 text-primary focus:ring-primary" />
              <span>Patient consent obtained to release this report <span className="font-semibold text-amber-700">(POPIA)</span></span>
            </label>
          </ReferralFormSection>
        </div>
        <button onClick={save} disabled={saving} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Report'}
        </button>
      </Modal>

      <Modal open={!!viewing} onClose={() => { setViewing(null); setEditing(false) }} title={editing ? 'Edit Report' : (viewing?.reportType || 'Medical Report')} size="xl">
        {viewing && !editing && (
          <div className="text-sm">
            <div className="-mx-6 -mt-2 mb-4 border-b border-slate-200 bg-gradient-to-r from-primary-light/60 to-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
                    {initials(viewing.patient)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight text-slate-800">{viewing.patient || '—'}</h3>
                    <p className="text-xs text-slate-600">{viewing.reportType || 'Medical Report'}</p>
                  </div>
                </div>
                {viewing.fitForWork && (
                  <StatusPill label={viewing.fitForWork} tone={viewing.fitForWork === 'Unfit' ? 'red' : viewing.fitForWork === 'Fit' ? 'green' : 'orange'} />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-xs">
                {viewing.patientIdNumber && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">ID Number</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.patientIdNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Date</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{fmtDate(viewing.date)}</p>
                </div>
                {viewing.practitioner && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Practitioner</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.practitioner}</p>
                  </div>
                )}
                {viewing.recipient && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Addressed To</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.recipient}</p>
                  </div>
                )}
              </div>
            </div>
            <Toolbar>
              <ToolbarBtn onClick={startEdit} icon={Pencil}>Edit</ToolbarBtn>
              <ToolbarBtn onClick={() => downloadPdf(viewing)} disabled={busy === 'pdf'} loading={busy === 'pdf'} icon={Download}>
                {busy === 'pdf' ? 'Generating…' : 'Download PDF'}
              </ToolbarBtn>
              <ToolbarBtn onClick={() => openEmail(viewing)} icon={Mail} primary>Email to Doctor</ToolbarBtn>
            </Toolbar>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardList size={13} /></span>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Report Details</h4>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/70">
                  <ReferralField label="Report Type" value={viewing.reportType} />
                  <ReferralField label="Diagnosis" value={viewing.diagnosis} />
                </div>
                {viewing.icd10 && (
                  <div className="border-t border-slate-200/70">
                    <ReferralField label="ICD-10 Code(s)" value={viewing.icd10} full />
                  </div>
                )}
              </div>

              {(viewing.history || viewing.clinicalFindings || viewing.treatment || viewing.prognosis) && (
                <div className="border-b border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Clinical Content</h4>
                  </div>
                  <div className="divide-y divide-border/70">
                    {viewing.history && <ReferralField label="Relevant History" value={viewing.history} full />}
                    {viewing.clinicalFindings && <ReferralField label="Clinical Findings" value={viewing.clinicalFindings} full />}
                    {viewing.treatment && <ReferralField label="Treatment / Management" value={viewing.treatment} full />}
                    {viewing.prognosis && <ReferralField label="Prognosis" value={viewing.prognosis} full />}
                  </div>
                </div>
              )}

              {viewing.fitForWork && (
                <div className="border-b border-slate-200">
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Activity size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Fitness / Booking Off</h4>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/70">
                    <ReferralField label="Status" value={viewing.fitForWork} />
                    <ReferralField label="Days Booked Off" value={viewing.daysBookedOff} />
                  </div>
                  {(viewing.fromDate || viewing.toDate) && (
                    <div className="grid grid-cols-2 divide-x divide-border/70 border-t border-slate-200/70">
                      <ReferralField label="From" value={fmtDate(viewing.fromDate)} />
                      <ReferralField label="To" value={fmtDate(viewing.toDate)} />
                    </div>
                  )}
                </div>
              )}

              {viewing.recommendations && (
                <div>
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><ClipboardList size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Recommendations</h4>
                  </div>
                  <ReferralField label="Recommendations" value={viewing.recommendations} full />
                </div>
              )}
            </div>
          </div>
        )}

        {viewing && editing && editForm && (
          <div className="space-y-4">
            <ReferralFormSection title="Report Details" icon={FileText}>
              <Field label="Report Type" select value={editForm.reportType} onChange={setE('reportType')}>
                {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
              </Field>
              <Field label="Date" type="date" value={editForm.date} onChange={setE('date')} />
              <Field label="Practitioner" value={editForm.practitioner} onChange={setE('practitioner')} />
              <div className="col-span-2"><Field label="Addressed To (recipient / employer / insurer)" value={editForm.recipient} onChange={setE('recipient')} /></div>
            </ReferralFormSection>

            <ReferralFormSection title="Clinical Content" icon={ClipboardList}>
              <div className="col-span-2"><Field label="Diagnosis" value={editForm.diagnosis} onChange={setE('diagnosis')} /></div>
              <Field label="ICD-10 Code(s)" value={editForm.icd10} onChange={setE('icd10')} placeholder="e.g. J45.9, I10" />
              <div className="col-span-2"><Field label="Relevant History" textarea value={editForm.history} onChange={setE('history')} /></div>
              <div className="col-span-2"><Field label="Clinical Findings" textarea value={editForm.clinicalFindings} onChange={setE('clinicalFindings')} /></div>
              <div className="col-span-2"><Field label="Treatment / Management" textarea value={editForm.treatment} onChange={setE('treatment')} /></div>
              <div className="col-span-2"><Field label="Prognosis" textarea value={editForm.prognosis} onChange={setE('prognosis')} /></div>
            </ReferralFormSection>

            {editIsSickNote && (
              <ReferralFormSection title="Fitness / Booking Off" icon={Activity}>
                <Field label="Fit for Work?" select value={editForm.fitForWork} onChange={setE('fitForWork')}>
                  <option value="">Select…</option>
                  {['Fit','Unfit','Fit with restrictions'].map(o => <option key={o}>{o}</option>)}
                </Field>
                <Field label="Days Booked Off" value={editForm.daysBookedOff} onChange={setE('daysBookedOff')} />
                <Field label="From" type="date" value={editForm.fromDate} onChange={setE('fromDate')} />
                <Field label="To" type="date" value={editForm.toDate} onChange={setE('toDate')} />
              </ReferralFormSection>
            )}

            <ReferralFormSection title="Recommendations" icon={ClipboardList}>
              <div className="col-span-2"><Field label="Recommendations" textarea value={editForm.recommendations} onChange={setE('recommendations')} /></div>
            </ReferralFormSection>

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {savingEdit ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><SaveIcon size={14} /> Save Changes</>}
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-primary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Email composer */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Email Report to Doctor" size="lg">
        <div className="space-y-4">
          <Field label="Recipient Email *" type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="doctor@practice.co.za" />
          <Field label="Message" textarea value={emailMsg} onChange={e => setEmailMsg(e.target.value)} />
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            The report will be attached as a branded PDF and sent securely from your practice address.
          </p>
          <button onClick={sendEmailToDoctor} disabled={busy === 'email'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy === 'email' ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Mail size={14} /> Send Email</>}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Referrals ───────────────────────────────────────────────────────────────────

// Read-only form field used inside the referral view modal
function ReferralField({ label, value, full }) {
  return (
    <div className={`px-4 py-3 ${full ? 'col-span-2' : ''}`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600/60">{label}</p>
      <p className={`text-sm leading-snug ${value ? 'text-slate-800' : 'italic text-slate-600/30'}`}>{value || '—'}</p>
    </div>
  )
}

// Titled section card wrapping form fields in new/edit modals
function ReferralFormSection({ title, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
        {Icon && <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon size={13} /></span>}
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">{children}</div>
    </div>
  )
}

// Titled section card for view modals with free-form children (no forced grid)
function RecordViewSection({ title, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
        {Icon && <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon size={13} /></span>}
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

const REFERRAL_STATUS = ['Sent','Acknowledged','Appointment Booked','Completed','Declined']
const URGENCY = ['Routine','Urgent','Emergency']
const REFERRAL_BLANK = {
  patientId: '', referringPractitioner: '', date: new Date().toISOString().slice(0, 10),
  specialist: '', specialistDiscipline: '', specialistPractice: '', specialistContact: '',
  reason: '', clinicalSummary: '', icd10: '', currentMedication: '',
  investigations: '', urgency: 'Routine', medicalAid: '', authNumber: '',
  status: 'Sent', consentObtained: false,
}

function Referrals() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const referrals = useCollection(uid ? `users/${uid}/referrals` : null)
  const patients = useCollection(uid ? `users/${uid}/patients` : null)
  const practitioners = useCollection(uid ? `users/${uid}/practitioners` : null)
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [form, setForm] = useState(REFERRAL_BLANK)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState('')           // 'pdf' | 'email'
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setE = k => e => setEditForm(f => ({ ...f, [k]: e.target.value }))

  const practice = {
    name: profile?.businessName || profile?.name || 'Tlhiso',
    logoUrl: profile?.businessLogoUrl || '',
    line: [profile?.practiceNumber && `Practice No. ${profile.practiceNumber}`, profile?.phone, profile?.email].filter(Boolean).join('  ·  '),
  }

  function selectPatient(e) {
    const id = e.target.value
    const p = patients.find(x => x.id === id)
    setForm(f => ({
      ...f, patientId: id,
      medicalAid: p ? `${p.medicalAid || ''}${p.memberNumber ? ` (${p.memberNumber})` : ''}`.trim() : f.medicalAid,
    }))
  }

  async function save() {
    if (!uid) return
    if (!form.patientId || !form.specialist) { alert('Patient and specialist are required.'); return }
    if (!form.consentObtained) { alert('POPIA: patient consent must be confirmed before sharing clinical information.'); return }
    setSaving(true)
    try {
      const patient = patients.find(p => p.id === form.patientId)
      await addDoc(collection(db, 'users', uid, 'referrals'), {
        ...form,
        patient: patient ? `${patient.firstName} ${patient.lastName}` : '',
        patientIdNumber: patient?.idNumber || '',
        createdAt: serverTimestamp(),
      })
      setForm(REFERRAL_BLANK); setOpen(false)
    } finally { setSaving(false) }
  }

  function openView(row) { setViewing(row); setEditing(false); setEditForm(null) }
  function startEdit() { setEditForm({ ...viewing }); setEditing(true) }

  async function saveEdit() {
    if (!uid || !editForm) return
    setSavingEdit(true)
    try {
      const { id, createdAt, ...payload } = editForm
      await updateDoc(doc(db, 'users', uid, 'referrals', id), payload)
      setViewing({ ...editForm }); setEditing(false)
    } finally { setSavingEdit(false) }
  }

  async function setStatus(r, status) {
    await updateDoc(doc(db, 'users', uid, 'referrals', r.id), { status })
  }

  function referralFilename(r) {
    return `referral-${(r.patient || 'patient').replace(/\s+/g, '_')}-${r.date || ''}.pdf`
  }

  async function downloadPdf(r) {
    setBusy('pdf')
    try {
      const blob = await pdfToBlob(<ReferralPDF r={r} practice={practice} />)
      downloadBlob(blob, referralFilename(r))
    } catch {
      alert('Could not generate the PDF.')
    } finally { setBusy('') }
  }

  function openEmail(r) {
    setEmailTo(r.specialistContact && r.specialistContact.includes('@') ? r.specialistContact : '')
    setEmailMsg(`Dear ${r.specialist || 'Doctor'},\n\nPlease find attached a referral for ${r.patient}${r.specialistDiscipline ? ` for your attention in ${r.specialistDiscipline}` : ''}.\n\n${r.reason ? `Reason: ${r.reason}\n\n` : ''}Kind regards,\n${r.referringPractitioner || practice.name}`)
    setEmailOpen(true)
  }

  async function sendEmailToSpecialist() {
    if (!viewing) return
    if (!emailTo || !emailTo.includes('@')) { alert('Enter a valid specialist email address.'); return }
    setBusy('email')
    try {
      const blob = await pdfToBlob(<ReferralPDF r={viewing} practice={practice} />)
      const base64 = await blobToBase64(blob)
      const htmlBody = `<p>${emailMsg.replace(/\n/g, '<br/>')}</p>`
      const fn = httpsCallable(functions, 'sendEmail')
      const res = await fn({
        to: emailTo,
        subject: `Referral — ${viewing.patient}${viewing.specialistDiscipline ? ` (${viewing.specialistDiscipline})` : ''}`,
        htmlBody,
        attachments: [{ content: base64, filename: referralFilename(viewing), type: 'application/pdf', disposition: 'attachment' }],
      })
      if (res.data?.success === false) throw new Error(res.data?.error || 'send failed')
      await addDoc(collection(db, 'users', uid, 'messages'), {
        to: emailTo, type: 'email', subject: `Referral — ${viewing.patient}`,
        body: emailMsg, module: 'referral', status: 'sent', sentAt: serverTimestamp(),
      })
      // bump status to Sent if still default
      if (viewing.status === 'Sent') { /* already sent */ } else { await setStatus(viewing, 'Sent') }
      setEmailOpen(false)
      alert('Referral emailed successfully.')
    } catch {
      alert('Email failed — confirm the sendEmail Cloud Function supports attachments and SendGrid is configured.')
    } finally { setBusy('') }
  }

  const badge = s => ({
    Sent: 'bg-blue-50 text-blue-600', Acknowledged: 'bg-purple-50 text-purple-600',
    'Appointment Booked': 'bg-primary/10 text-primary', Completed: 'bg-green-50 text-green-600',
    Declined: 'bg-red-50 text-red-500',
  }[s] || 'bg-slate-50 text-slate-600')

  const cols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'patient', label: 'Patient' },
    { key: 'specialist', label: 'Referred To' },
    { key: 'specialistDiscipline', label: 'Discipline' },
    { key: 'urgency', label: 'Urgency' },
    { key: 'status', label: 'Status', render: r => (
      <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setStatus(r, e.target.value) }}
        className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${badge(r.status)}`}>
        {REFERRAL_STATUS.map(s => <option key={s}>{s}</option>)}
      </select>
    )},
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this referral? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'referrals', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Referrals</h2>
        <button onClick={() => { setForm(REFERRAL_BLANK); setOpen(true) }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Referral
        </button>
      </div>
      <DataTable columns={cols} data={referrals} emptyMessage="No referrals yet." onRowClick={openView} />

      <Modal open={open} onClose={() => setOpen(false)} title="New Referral" size="xl">
        <div className="space-y-4">
          <ReferralFormSection title="Patient & Referrer" icon={User}>
            <Field label="Patient *" select value={form.patientId} onChange={selectPatient}>
              <option value="">Select patient…</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </Field>
            <Field label="Referring Practitioner" select value={form.referringPractitioner} onChange={set('referringPractitioner')}>
              <option value="">Select…</option>
              {practitioners.map(p => <option key={p.id} value={`${p.title || ''} ${p.name}`.trim()}>{p.title} {p.name}</option>)}
            </Field>
            <Field label="Date" type="date" value={form.date} onChange={set('date')} />
            <Field label="Urgency" select value={form.urgency} onChange={set('urgency')}>
              {URGENCY.map(u => <option key={u}>{u}</option>)}
            </Field>
          </ReferralFormSection>

          <ReferralFormSection title="Refer To (Specialist)" icon={UserCircle}>
            <Field label="Specialist Name *" value={form.specialist} onChange={set('specialist')} />
            <Field label="Discipline / Speciality" value={form.specialistDiscipline} onChange={set('specialistDiscipline')} placeholder="e.g. Cardiology" />
            <Field label="Practice / Hospital" value={form.specialistPractice} onChange={set('specialistPractice')} />
            <Field label="Specialist Contact" value={form.specialistContact} onChange={set('specialistContact')} placeholder="Phone / email" />
          </ReferralFormSection>

          <ReferralFormSection title="Clinical Information" icon={FileText}>
            <div className="col-span-2"><Field label="Reason for Referral" value={form.reason} onChange={set('reason')} /></div>
            <Field label="ICD-10 Code(s)" value={form.icd10} onChange={set('icd10')} placeholder="e.g. I25.9" />
            <Field label="Current Medication" value={form.currentMedication} onChange={set('currentMedication')} />
            <div className="col-span-2"><Field label="Clinical Summary / History" textarea value={form.clinicalSummary} onChange={set('clinicalSummary')} /></div>
            <div className="col-span-2"><Field label="Relevant Investigations / Results" textarea value={form.investigations} onChange={set('investigations')} /></div>
          </ReferralFormSection>

          <ReferralFormSection title="Medical Aid & Authorisation" icon={CreditCard}>
            <Field label="Medical Aid (auto-filled)" value={form.medicalAid} onChange={set('medicalAid')} />
            <Field label="Pre-Authorisation No." value={form.authNumber} onChange={set('authNumber')} />
            <label className="col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-amber-50 px-4 py-3 text-sm text-slate-800">
              <input type="checkbox" checked={form.consentObtained} onChange={e => setForm(f => ({ ...f, consentObtained: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-200 text-primary focus:ring-primary" />
              <span>Patient consent obtained to share clinical information with the specialist <span className="font-semibold text-amber-700">(POPIA)</span></span>
            </label>
          </ReferralFormSection>
        </div>
        <button onClick={save} disabled={saving} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Referral'}
        </button>
      </Modal>

      {/* View / edit referral */}
      <Modal open={!!viewing} onClose={() => { setViewing(null); setEditing(false) }} title={editing ? 'Edit Referral' : 'Referral Letter'} size="xl">
        {viewing && !editing && (
          <div className="text-sm">
            {/* Header */}
            <div className="-mx-6 -mt-2 mb-4 border-b border-slate-200 bg-gradient-to-r from-primary-light/60 to-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
                    {initials(viewing.patient)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-tight text-slate-800">{viewing.patient || '—'}</h3>
                    <p className="text-xs text-slate-600">Referral Letter</p>
                  </div>
                </div>
                <StatusPill label={viewing.status} tone={REFERRAL_TONE[viewing.status] || 'slate'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-xs">
                {viewing.patientIdNumber && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">ID Number</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.patientIdNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Date</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{fmtDate(viewing.date)}</p>
                </div>
                {viewing.referringPractitioner && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Referring Practitioner</p>
                    <p className="mt-0.5 font-semibold text-slate-800">{viewing.referringPractitioner}</p>
                  </div>
                )}
                {viewing.urgency && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600/60">Urgency</p>
                    <div className="mt-1"><StatusPill label={viewing.urgency} tone={URGENCY_TONE[viewing.urgency] || 'slate'} /></div>
                  </div>
                )}
              </div>
            </div>

            {/* Toolbar */}
            <Toolbar>
              <ToolbarBtn onClick={startEdit} icon={Pencil}>Edit</ToolbarBtn>
              <ToolbarBtn onClick={() => downloadPdf(viewing)} disabled={busy === 'pdf'} loading={busy === 'pdf'} icon={Download}>
                {busy === 'pdf' ? 'Generating…' : 'Download PDF'}
              </ToolbarBtn>
              <ToolbarBtn onClick={() => openEmail(viewing)} icon={Mail} primary>Email to Specialist</ToolbarBtn>
            </Toolbar>

            {/* Form-grid sections */}
            <div className="overflow-hidden rounded-xl border border-slate-200">

              {/* Refer To (Specialist) */}
              <div className="border-b border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><UserCircle size={13} /></span>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Refer To (Specialist)</h4>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/70">
                  <ReferralField label="Specialist" value={viewing.specialist} />
                  <ReferralField label="Discipline" value={viewing.specialistDiscipline} />
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/70 border-t border-slate-200/70">
                  <ReferralField label="Practice / Hospital" value={viewing.specialistPractice} />
                  <ReferralField label="Contact" value={viewing.specialistContact} />
                </div>
              </div>

              {/* Clinical Information */}
              <div className="border-b border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText size={13} /></span>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Clinical Information</h4>
                </div>
                <div className="divide-y divide-border/70">
                  {viewing.reason && (
                    <ReferralField label="Reason for Referral" value={viewing.reason} full />
                  )}
                  <div className="grid grid-cols-2 divide-x divide-border/70">
                    <ReferralField label="ICD-10 Code(s)" value={viewing.icd10} />
                    <ReferralField label="Current Medication" value={viewing.currentMedication} />
                  </div>
                  {viewing.clinicalSummary && <ReferralField label="Clinical Summary / History" value={viewing.clinicalSummary} full />}
                  {viewing.investigations && <ReferralField label="Investigations / Results" value={viewing.investigations} full />}
                </div>
              </div>

              {/* Medical Aid & Authorisation */}
              {(viewing.medicalAid || viewing.authNumber) && (
                <div>
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><CreditCard size={13} /></span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Medical Aid & Authorisation</h4>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/70">
                    <ReferralField label="Medical Aid" value={viewing.medicalAid} />
                    <ReferralField label="Pre-Authorisation No." value={viewing.authNumber} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {viewing && editing && editForm && (
          <div className="space-y-4">
            <ReferralFormSection title="Patient & Referrer" icon={User}>
              <Field label="Referring Practitioner" value={editForm.referringPractitioner} onChange={setE('referringPractitioner')} />
              <Field label="Date" type="date" value={editForm.date} onChange={setE('date')} />
              <Field label="Urgency" select value={editForm.urgency} onChange={setE('urgency')}>
                {URGENCY.map(u => <option key={u}>{u}</option>)}
              </Field>
              <Field label="Status" select value={editForm.status} onChange={setE('status')}>
                {REFERRAL_STATUS.map(s => <option key={s}>{s}</option>)}
              </Field>
            </ReferralFormSection>

            <ReferralFormSection title="Refer To (Specialist)" icon={UserCircle}>
              <Field label="Specialist Name" value={editForm.specialist} onChange={setE('specialist')} />
              <Field label="Discipline / Speciality" value={editForm.specialistDiscipline} onChange={setE('specialistDiscipline')} />
              <Field label="Practice / Hospital" value={editForm.specialistPractice} onChange={setE('specialistPractice')} />
              <Field label="Specialist Contact" value={editForm.specialistContact} onChange={setE('specialistContact')} />
            </ReferralFormSection>

            <ReferralFormSection title="Clinical Information" icon={FileText}>
              <div className="col-span-2"><Field label="Reason for Referral" value={editForm.reason} onChange={setE('reason')} /></div>
              <Field label="ICD-10 Code(s)" value={editForm.icd10} onChange={setE('icd10')} />
              <Field label="Current Medication" value={editForm.currentMedication} onChange={setE('currentMedication')} />
              <div className="col-span-2"><Field label="Clinical Summary / History" textarea value={editForm.clinicalSummary} onChange={setE('clinicalSummary')} /></div>
              <div className="col-span-2"><Field label="Relevant Investigations / Results" textarea value={editForm.investigations} onChange={setE('investigations')} /></div>
            </ReferralFormSection>

            <ReferralFormSection title="Medical Aid & Authorisation" icon={CreditCard}>
              <Field label="Medical Aid" value={editForm.medicalAid} onChange={setE('medicalAid')} />
              <Field label="Pre-Authorisation No." value={editForm.authNumber} onChange={setE('authNumber')} />
            </ReferralFormSection>

            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {savingEdit ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><SaveIcon size={14} /> Save Changes</>}
              </button>
              <button onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-primary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Email composer */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Email Referral to Specialist" size="lg">
        <div className="space-y-4">
          <Field label="Specialist Email *" type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="specialist@practice.co.za" />
          <Field label="Message" textarea value={emailMsg} onChange={e => setEmailMsg(e.target.value)} />
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            The referral will be attached as a branded PDF letter and sent securely from your practice address.
          </p>
          <button onClick={sendEmailToSpecialist} disabled={busy === 'email'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {busy === 'email' ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Mail size={14} /> Send Email</>}
          </button>
        </div>
      </Modal>
    </div>
  )
}


// ── Settings ──────────────────────────────────────────────────────────────────
function Settings() {
  return <SettingsPage industry="medical" />
}

export default function MedicalDashboard() {
  return (
    <DashboardLayout industry="medical" pageTitle="Medical & Health">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="patients" element={<Patients />} />
        <Route path="consultations" element={<Consultations />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="practitioners" element={<Practitioners />} />
        <Route path="reports" element={<Reports />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="surveys" element={<SurveysModule industry="medical" />} />
        <Route path="campaigns"    element={<CampaignsModule industry="medical" />} />
        <Route path="automations" element={<AutomationsModule industry="medical" />} />
        <Route path="profile" element={<ProfilePage industry="medical" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<div><h2 className="text-base font-bold text-slate-800 mb-3">Coming Soon</h2><p className="text-sm text-slate-600">This section is being built.</p></div>} />
      </Routes>
    </DashboardLayout>
  )
}
