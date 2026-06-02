import { useState } from 'react'
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
import { db, storage } from '../../../services/firebase'
import { PlusCircle, Trash2, MapPin } from 'lucide-react'

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
  const properties = useCollection(uid ? `users/${uid}/properties` : null)
  const tenants = useCollection(uid ? `users/${uid}/tenants` : null)
  const maintenance = useCollection(uid ? `users/${uid}/maintenance` : null)

  const totalRent = tenants.reduce((s, t) => s + Number(t.rentAmount ?? 0), 0)
  const activeTenants = tenants.filter(t => t.status === 'Active').length
  const openMaintenance = maintenance.filter(m => m.status === 'Open').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Properties" value={properties.length} icon="🏘️" />
        <StatCard label="Active Tenants" value={activeTenants} icon="👥" color="blue" />
        <StatCard label="Rent This Month" value={`R${totalRent.toLocaleString()}`} icon="💰" color="purple" />
        <StatCard label="Open Maintenance" value={openMaintenance} icon="🔧" color="orange" />
      </div>

      {/* Simple property list as "map substitute" */}
      <div className="rounded-card border border-border bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-ink">Properties Overview</h3>
        </div>
        {properties.length === 0
          ? <p className="text-sm text-ink-secondary">No properties added yet.</p>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map(p => (
                <div key={p.id} className="rounded-xl border border-border p-4">
                  <p className="font-bold text-ink text-sm">{p.name}</p>
                  <p className="text-xs text-ink-secondary mt-1">{p.address}</p>
                  <p className="text-xs text-ink-secondary">{p.units} units · {p.type}</p>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Properties ────────────────────────────────────────────────────────────────
function Properties() {
  const { user } = useAuth()
  const uid = user?.uid
  const properties = useCollection(uid ? `users/${uid}/properties` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', type: 'Residential', units: '', purchasePrice: '', owner: '' })

  async function save() {
    if (!uid || !form.name) return
    await addDoc(collection(db, 'users', uid, 'properties'), { ...form, createdAt: serverTimestamp() })
    setOpen(false)
  }

  const cols = [
    { key: 'name', label: 'Property Name' },
    { key: 'address', label: 'Address' },
    { key: 'type', label: 'Type' },
    { key: 'units', label: 'Units' },
    { key: 'owner', label: 'Owner' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'users', uid, 'properties', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Properties</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          <PlusCircle size={15} /> Add Property
        </button>
      </div>
      <DataTable columns={cols} data={properties} emptyMessage="No properties yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Property">
        <div className="space-y-4">
          <Field label="Property Name *" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
          <Field label="Address" value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))} />
          <Field label="Type" select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
            {['Residential','Commercial','Industrial','Mixed Use'].map(t=><option key={t}>{t}</option>)}
          </Field>
          <Field label="Number of Units" type="number" value={form.units} onChange={e => setForm(f=>({...f,units:e.target.value}))} />
          <Field label="Purchase Price (R)" type="number" value={form.purchasePrice} onChange={e => setForm(f=>({...f,purchasePrice:e.target.value}))} />
          <Field label="Owner" value={form.owner} onChange={e => setForm(f=>({...f,owner:e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Property</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Tenants ───────────────────────────────────────────────────────────────────
function Tenants() {
  const { user } = useAuth()
  const uid = user?.uid
  const tenants = useCollection(uid ? `users/${uid}/tenants` : null)
  const properties = useCollection(uid ? `users/${uid}/properties` : null)
  const [open, setOpen] = useState(false)
  const [docFile, setDocFile] = useState(null)
  const [form, setForm] = useState({
    firstName: '', lastName: '', idNumber: '', phone: '', email: '',
    propertyId: '', unitNumber: '', leaseStart: '', leaseEnd: '',
    rentAmount: '', depositPaid: '', status: 'Active',
  })

  async function save() {
    if (!uid || !form.firstName) return
    let docUrl = ''
    if (docFile) {
      const storageRef = ref(storage, `users/${uid}/tenants/${Date.now()}_${docFile.name}`)
      await uploadBytes(storageRef, docFile)
      docUrl = await getDownloadURL(storageRef)
    }
    const prop = properties.find(p => p.id === form.propertyId)
    await addDoc(collection(db, 'users', uid, 'tenants'), {
      ...form, property: prop?.name ?? '', documentUrl: docUrl, createdAt: serverTimestamp(),
    })
    setOpen(false)
  }

  const statusColor = s => ({ Active: 'bg-green-100 text-green-700', 'Notice Given': 'bg-amber-100 text-amber-700', Vacated: 'bg-gray-100 text-gray-600' }[s] ?? '')

  const cols = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'property', label: 'Property' },
    { key: 'unitNumber', label: 'Unit' },
    { key: 'rentAmount', label: 'Rent', render: r => `R${Number(r.rentAmount??0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: r => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'users', uid, 'tenants', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Tenants</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          <PlusCircle size={15} /> Add Tenant
        </button>
      </div>
      <DataTable columns={cols} data={tenants} emptyMessage="No tenants yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Tenant" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name *" value={form.firstName} onChange={e => setForm(f=>({...f,firstName:e.target.value}))} />
          <Field label="Last Name *" value={form.lastName} onChange={e => setForm(f=>({...f,lastName:e.target.value}))} />
          <Field label="SA ID Number" value={form.idNumber} onChange={e => setForm(f=>({...f,idNumber:e.target.value}))} />
          <Field label="Phone" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
          <Field label="Email" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
          <Field label="Property" select value={form.propertyId} onChange={e => setForm(f=>({...f,propertyId:e.target.value}))}>
            <option value="">Select…</option>
            {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </Field>
          <Field label="Unit Number" value={form.unitNumber} onChange={e => setForm(f=>({...f,unitNumber:e.target.value}))} />
          <Field label="Rent Amount (R)" type="number" value={form.rentAmount} onChange={e => setForm(f=>({...f,rentAmount:e.target.value}))} />
          <Field label="Lease Start" type="date" value={form.leaseStart} onChange={e => setForm(f=>({...f,leaseStart:e.target.value}))} />
          <Field label="Lease End" type="date" value={form.leaseEnd} onChange={e => setForm(f=>({...f,leaseEnd:e.target.value}))} />
          <Field label="Deposit Paid (R)" type="number" value={form.depositPaid} onChange={e => setForm(f=>({...f,depositPaid:e.target.value}))} />
          <Field label="Status" select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
            {['Active','Notice Given','Vacated'].map(s=><option key={s}>{s}</option>)}
          </Field>
          <div className="col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Upload Document (Lease, ID, etc.)</span>
            <input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="text-sm text-ink-secondary" />
          </div>
        </div>
        <button onClick={save} className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Tenant</button>
      </Modal>
    </div>
  )
}

// ── Maintenance ───────────────────────────────────────────────────────────────
function Maintenance() {
  const { user } = useAuth()
  const uid = user?.uid
  const logs = useCollection(uid ? `users/${uid}/maintenance` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ property: '', unit: '', description: '', priority: 'Medium', contractor: '', status: 'Open' })

  async function save() {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'maintenance'), { ...form, createdAt: serverTimestamp() })
    setOpen(false)
  }

  const priorityColor = p => ({ High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-green-100 text-green-700' }[p] ?? '')

  const cols = [
    { key: 'property', label: 'Property' },
    { key: 'unit', label: 'Unit' },
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priority', render: r => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityColor(r.priority)}`}>{r.priority}</span> },
    { key: 'contractor', label: 'Contractor' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'maintenance', r.id), { status: 'Resolved' }) }}
        className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">Resolve</button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Maintenance</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          <PlusCircle size={15} /> Log Request
        </button>
      </div>
      <DataTable columns={cols} data={logs} emptyMessage="No maintenance requests." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Maintenance Request">
        <div className="space-y-4">
          <Field label="Property" value={form.property} onChange={e => setForm(f=>({...f,property:e.target.value}))} />
          <Field label="Unit" value={form.unit} onChange={e => setForm(f=>({...f,unit:e.target.value}))} />
          <Field label="Description" textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
          <Field label="Priority" select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))}>
            {['High','Medium','Low'].map(p=><option key={p}>{p}</option>)}
          </Field>
          <Field label="Assigned Contractor" value={form.contractor} onChange={e => setForm(f=>({...f,contractor:e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Request</button>
        </div>
      </Modal>
    </div>
  )
}

function SimplePage({ title }) {
  return <div><h2 className="text-base font-bold text-ink mb-3">{title}</h2><p className="text-sm text-ink-secondary">This section is being built.</p></div>
}

export default function PropertyDashboard() {
  return (
    <DashboardLayout industry="property" pageTitle="Property Management">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="properties" element={<Properties />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="profile" element={<ProfilePage industry="property" />} />
        <Route path="popia" element={<PopiaModule />} />
        <Route path="*" element={<SimplePage title="Coming Soon" />} />
      </Routes>
    </DashboardLayout>
  )
}
