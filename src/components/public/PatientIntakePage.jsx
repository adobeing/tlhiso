// Public patient intake form — no login required.
// Route: /intake/:userId
// Firestore: writes users/{userId}/patients/{auto} with source:'intake-form'

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { CheckCircle2, Loader2, ClipboardList } from 'lucide-react'

function Field({ label, required, error, textarea, select, children, ...props }) {
  const cls = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition'
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {textarea ? <textarea {...props} className={cls + ' h-20 resize-none'} /> :
       select    ? <select {...props} className={cls}>{children}</select> :
                   <input {...props} className={cls} />}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

function SecHead({ label }) {
  return (
    <div className="col-span-2 mt-2 border-b border-gray-100 pb-1.5">
      <p className="text-xs font-bold uppercase tracking-wider text-teal-600">{label}</p>
    </div>
  )
}

export default function PatientIntakePage() {
  const { userId } = useParams()

  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', idNumber: '', gender: '', maritalStatus: '',
    phone: '', email: '', address: '',
    nextOfKinName: '', nextOfKinRelationship: '', nextOfKinPhone: '',
    medicalAid: '', planName: '', memberNumber: '', principalMember: '',
    allergies: '', chronicConditions: '', currentMedication: '',
    notes: '', popiaConsent: false,
  })
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  function validate() {
    const e = {}
    if (!form.firstName.trim())  e.firstName    = 'Required'
    if (!form.lastName.trim())   e.lastName     = 'Required'
    if (!form.phone.trim())      e.phone        = 'Required'
    if (form.idNumber && !/^\d{13}$/.test(form.idNumber)) e.idNumber = 'Must be exactly 13 digits'
    if (!form.popiaConsent)      e.popiaConsent = 'Consent is required to proceed'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const toArr = text => text.split('\n').map(s => s.trim()).filter(Boolean)
      await addDoc(collection(db, 'users', userId, 'patients'), {
        firstName:        form.firstName.trim(),
        lastName:         form.lastName.trim(),
        dob:              form.dob,
        idNumber:         form.idNumber.trim(),
        gender:           form.gender,
        maritalStatus:    form.maritalStatus,
        phone:            form.phone.trim(),
        email:            form.email.trim(),
        address:          form.address.trim(),
        nextOfKinName:    form.nextOfKinName.trim(),
        nextOfKinRelationship: form.nextOfKinRelationship.trim(),
        nextOfKinPhone:   form.nextOfKinPhone.trim(),
        medicalAid:       form.medicalAid.trim(),
        planName:         form.planName.trim(),
        memberNumber:     form.memberNumber.trim(),
        principalMember:  form.principalMember.trim(),
        allergies:        toArr(form.allergies).map(a => ({ allergen: a, reaction: '', severity: '' })),
        chronicConditions: toArr(form.chronicConditions).map(c => ({ condition: c, icd10: '' })),
        currentMedication: toArr(form.currentMedication).map(m => ({ name: m, dosage: '', frequency: '' })),
        notes:            form.notes.trim(),
        popiaConsent:     true,
        source:           'intake-form',
        createdAt:        serverTimestamp(),
      })
      setSubmitted(true)
    } catch {
      alert('Submission failed. Please try again or contact the practice directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
            <CheckCircle2 size={32} className="text-teal-600" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">Form Submitted</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Thank you. Your information has been securely received by the practice. Please bring your ID document and medical aid card to your appointment.
          </p>
          <p className="mt-4 text-xs text-gray-400">All data is encrypted and POPIA-compliant</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 px-6 py-7 text-white shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
              <ClipboardList size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">Patient Intake Form</h1>
              <p className="mt-0.5 text-sm text-teal-100">
                Please fill in your details accurately. All information is kept strictly confidential.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">

            <SecHead label="Personal Details" />
            <Field label="First Name" required value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
            <Field label="Last Name"  required value={form.lastName}  onChange={set('lastName')}  error={errors.lastName} />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={set('dob')} />
            <Field label="SA ID Number (13 digits)" value={form.idNumber} onChange={set('idNumber')} maxLength={13} inputMode="numeric" error={errors.idNumber} />
            <Field label="Gender" select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              {['Male','Female','Non-binary','Prefer not to say'].map(g => <option key={g}>{g}</option>)}
            </Field>
            <Field label="Marital Status" select value={form.maritalStatus} onChange={set('maritalStatus')}>
              <option value="">Select…</option>
              {['Single','Married','Divorced','Widowed'].map(s => <option key={s}>{s}</option>)}
            </Field>

            <SecHead label="Contact Details" />
            <Field label="Phone (+27…)" required type="tel" value={form.phone} onChange={set('phone')} placeholder="+27821234567" error={errors.phone} />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} />
            <div className="col-span-2">
              <Field label="Physical Address" textarea value={form.address} onChange={set('address')} />
            </div>

            <SecHead label="Next of Kin" />
            <Field label="Full Name" value={form.nextOfKinName} onChange={set('nextOfKinName')} />
            <Field label="Relationship" value={form.nextOfKinRelationship} onChange={set('nextOfKinRelationship')} placeholder="e.g. Spouse, Parent" />
            <div className="col-span-2">
              <Field label="Phone Number" type="tel" value={form.nextOfKinPhone} onChange={set('nextOfKinPhone')} />
            </div>

            <SecHead label="Medical Aid" />
            <Field label="Medical Aid Name" value={form.medicalAid} onChange={set('medicalAid')} placeholder="e.g. Discovery, Momentum" />
            <Field label="Plan / Option"    value={form.planName} onChange={set('planName')} />
            <Field label="Member Number"    value={form.memberNumber} onChange={set('memberNumber')} />
            <Field label="Principal Member (if dependant)" value={form.principalMember} onChange={set('principalMember')} />

            <SecHead label="Medical History" />
            <div className="col-span-2">
              <Field label="Known Allergies (one per line)" textarea value={form.allergies} onChange={set('allergies')}
                placeholder={'Penicillin — rash\nPeanuts — anaphylaxis'} />
            </div>
            <div className="col-span-2">
              <Field label="Chronic Conditions (one per line)" textarea value={form.chronicConditions} onChange={set('chronicConditions')}
                placeholder={'Hypertension\nType 2 Diabetes'} />
            </div>
            <div className="col-span-2">
              <Field label="Current Medication (one per line)" textarea value={form.currentMedication} onChange={set('currentMedication')}
                placeholder={'Metformin 500mg twice daily\nAmlodipine 5mg once daily'} />
            </div>
            <div className="col-span-2">
              <Field label="Additional Notes (optional)" textarea value={form.notes} onChange={set('notes')} />
            </div>
          </div>

          {/* POPIA consent */}
          <div className={`rounded-xl border px-4 py-4 ${errors.popiaConsent ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.popiaConsent}
                onChange={e => setForm(f => ({ ...f, popiaConsent: e.target.checked }))}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-teal-600"
              />
              <span className="text-xs leading-relaxed text-gray-600">
                <strong className="text-gray-900">POPIA Consent — </strong>
                I consent to this practice collecting, storing and processing my personal information submitted on this form for the purpose of providing healthcare services. I understand my information is protected under the Protection of Personal Information Act 4 of 2013 (POPIA) and that I may request access to or deletion of my records at any time.
              </span>
            </label>
            {errors.popiaConsent && <p className="mt-1.5 text-xs text-red-600">{errors.popiaConsent}</p>}
          </div>

          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60">
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
              : 'Submit Patient Intake Form'}
          </button>

          <p className="text-center text-[11px] text-gray-400">
            Your information is encrypted and stored securely. POPIA-compliant.
          </p>
        </form>
      </div>
    </div>
  )
}
