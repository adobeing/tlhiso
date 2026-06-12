// Finance module — QuickBooks-style money management for invoice-heavy
// industries (B2B + Property). Three pieces on one page:
//   1. P&L KPIs for the current month (income from paid invoices, expenses, net)
//   2. 6-month cash flow chart (income vs expenses)
//   3. SA VAT helper (output VAT on paid invoices, input VAT on vatable
//      expenses at 15/115, net position) + expense register
//
// Expenses live in users/{uid}/expenses:
//   { date 'yyyy-mm-dd', supplier, category, amount (incl VAT), vatable, notes }

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import Modal from './Modal'
import DataTable from './DataTable'
import { PlusCircle, Trash2, Wallet, TrendingUp, TrendingDown, Landmark, ReceiptText } from 'lucide-react'

const EXPENSE_CATEGORIES = [
  'Rent & Utilities', 'Salaries & Wages', 'Stock / Materials', 'Office Supplies',
  'Travel & Fuel', 'Marketing & Advertising', 'Professional Fees', 'Insurance',
  'Equipment & Maintenance', 'Telephone & Internet', 'Bank Charges', 'Other',
]

const BLANK_EXPENSE = {
  date: new Date().toISOString().slice(0, 10),
  supplier: '', category: '', amount: '', vatable: true, notes: '',
}

const fmtR = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Invoice date: property invoices carry issueDate, B2B only createdAt
function invoiceMonth(inv) {
  if (inv.issueDate) return String(inv.issueDate).slice(0, 7)
  const d = inv.createdAt?.toDate?.()
  return d ? d.toISOString().slice(0, 7) : null
}

export default function FinanceModule({ industry }) {
  const { user } = useAuth()
  const uid = user?.uid

  const invoices = useCollection(uid ? `users/${uid}/invoices` : null)
  const expenses = useCollection(uid ? `users/${uid}/expenses` : null)

  const [open,   setOpen]   = useState(false)
  const [form,   setForm]   = useState(BLANK_EXPENSE)
  const [saving, setSaving] = useState(false)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisYear  = new Date().getFullYear().toString()

  const paidInvoices = useMemo(() => invoices.filter(i => i.status === 'Paid'), [invoices])

  // VAT on an expense: amounts are captured inclusive, so the input VAT
  // portion is amount × 15/115 when the supplier is VAT-registered.
  const inputVat = e => e.vatable === false ? 0 : Number(e.amount ?? 0) * 15 / 115
  const outputVat = inv => Number(inv.vat ?? (Number(inv.total ?? 0) * 15 / 115))

  const stats = useMemo(() => {
    const s = {
      incomeMonth: 0, expensesMonth: 0,
      outputVatMonth: 0, inputVatMonth: 0,
      incomeYtd: 0, expensesYtd: 0,
      outputVatYtd: 0, inputVatYtd: 0,
    }
    paidInvoices.forEach(inv => {
      const m = invoiceMonth(inv)
      if (!m) return
      const amt = Number(inv.total ?? 0)
      if (m === thisMonth)          { s.incomeMonth += amt; s.outputVatMonth += outputVat(inv) }
      if (m.startsWith(thisYear))   { s.incomeYtd   += amt; s.outputVatYtd   += outputVat(inv) }
    })
    expenses.forEach(e => {
      const m = String(e.date ?? '').slice(0, 7)
      const amt = Number(e.amount ?? 0)
      if (m === thisMonth)          { s.expensesMonth += amt; s.inputVatMonth += inputVat(e) }
      if (m.startsWith(thisYear))   { s.expensesYtd   += amt; s.inputVatYtd   += inputVat(e) }
    })
    return s
  }, [paidInvoices, expenses, thisMonth, thisYear])

  const netMonth  = stats.incomeMonth - stats.expensesMonth
  const vatDueMonth = stats.outputVatMonth - stats.inputVatMonth
  const vatDueYtd   = stats.outputVatYtd   - stats.inputVatYtd

  // Last 6 months income vs expenses
  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - (5 - i))
      return {
        key:   d.toISOString().slice(0, 7),
        label: d.toLocaleString('en-ZA', { month: 'short' }),
        income: 0, expenses: 0,
      }
    })
    paidInvoices.forEach(inv => {
      const m = months.find(x => x.key === invoiceMonth(inv))
      if (m) m.income += Number(inv.total ?? 0)
    })
    expenses.forEach(e => {
      const m = months.find(x => x.key === String(e.date ?? '').slice(0, 7))
      if (m) m.expenses += Number(e.amount ?? 0)
    })
    return months
  }, [paidInvoices, expenses])

  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))),
    [expenses]
  )

  async function saveExpense() {
    if (!uid || saving) return
    if (!form.date || !form.category || !Number(form.amount)) {
      alert('Please fill in the date, category and amount.')
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'users', uid, 'expenses'), {
        date:     form.date,
        supplier: form.supplier.trim(),
        category: form.category,
        amount:   Number(form.amount),
        vatable:  !!form.vatable,
        notes:    form.notes.trim(),
        createdAt: serverTimestamp(),
      })
      setOpen(false)
      setForm(BLANK_EXPENSE)
    } catch (e) {
      alert('Failed to save expense: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const cols = [
    { key: 'date',     label: 'Date' },
    { key: 'supplier', label: 'Supplier', render: r => r.supplier || '—' },
    { key: 'category', label: 'Category', render: r => (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{r.category || '—'}</span>
    )},
    { key: 'amount', label: 'Amount (incl VAT)', render: r => <span className="font-semibold">{fmtR(r.amount)}</span> },
    { key: 'vatable', label: 'Input VAT', render: r => (
      r.vatable === false
        ? <span className="text-xs text-slate-400">—</span>
        : <span className="text-xs text-slate-600">{fmtR(inputVat(r))}</span>
    )},
    { key: 'actions', label: '', sortable: false, render: r => (
      <button
        onClick={e => {
          e.stopPropagation()
          if (window.confirm('Delete this expense?')) deleteDoc(doc(db, 'users', uid, 'expenses', r.id))
        }}
        className="rounded p-1 text-red-400 transition hover:bg-red-50">
        <Trash2 size={14} />
      </button>
    )},
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Finance</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Income, expenses and VAT at a glance. Income is calculated from paid invoices.
          </p>
        </div>
        <button onClick={() => { setForm(BLANK_EXPENSE); setOpen(true) }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> Add Expense
        </button>
      </div>

      {/* P&L KPIs — this month */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-emerald-600"><TrendingUp size={15} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Income · this month</p>
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">{fmtR(stats.incomeMonth)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{fmtR(stats.incomeYtd)} year to date</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-orange-500"><TrendingDown size={15} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Expenses · this month</p>
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">{fmtR(stats.expensesMonth)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{fmtR(stats.expensesYtd)} year to date</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-primary"><Wallet size={15} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Net profit · this month</p>
          </div>
          <p className={`text-2xl font-black tracking-tight tabular-nums ${netMonth < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            {fmtR(netMonth)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{fmtR(stats.incomeYtd - stats.expensesYtd)} year to date</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-blue-600"><Landmark size={15} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">VAT position · this month</p>
          </div>
          <p className={`text-2xl font-black tracking-tight tabular-nums ${vatDueMonth > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
            {fmtR(Math.abs(vatDueMonth))}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{vatDueMonth >= 0 ? 'payable to SARS' : 'refund due'}</p>
        </div>
      </div>

      {/* Cash flow chart + VAT summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-bold text-slate-800">Cash Flow — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `R${Math.round(v / 1000)}k` : `R${v}`} />
              <Tooltip
                formatter={v => fmtR(v)}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                cursor={{ fill: '#f8fafc' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income"   name="Income"   fill="#5B8E7D" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expenses" name="Expenses" fill="#F97316" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* VAT201 helper */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ReceiptText size={14} /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">VAT Summary</h3>
              <p className="text-[11px] text-slate-400">15% — figures for your VAT201 return</p>
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span /><span className="text-right">This month</span><span className="text-right">Year to date</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5">
              <span className="text-slate-600">Output VAT</span>
              <span className="text-right font-semibold tabular-nums">{fmtR(stats.outputVatMonth)}</span>
              <span className="text-right text-slate-500 tabular-nums">{fmtR(stats.outputVatYtd)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1.5">
              <span className="text-slate-600">Input VAT</span>
              <span className="text-right font-semibold tabular-nums">{fmtR(stats.inputVatMonth)}</span>
              <span className="text-right text-slate-500 tabular-nums">{fmtR(stats.inputVatYtd)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-800">Net VAT</span>
              <span className={`text-right font-black tabular-nums ${vatDueMonth >= 0 ? 'text-slate-900' : 'text-emerald-600'}`}>{fmtR(vatDueMonth)}</span>
              <span className={`text-right font-bold tabular-nums ${vatDueYtd >= 0 ? 'text-slate-700' : 'text-emerald-600'}`}>{fmtR(vatDueYtd)}</span>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Output VAT is calculated on paid invoices; input VAT on expenses marked as VAT-inclusive
            (15/115). Always confirm figures with your accountant before filing.
          </p>
        </div>
      </div>

      {/* Expense register */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Expense Register</h3>
          <span className="text-xs text-slate-400">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded</span>
        </div>
        <DataTable
          columns={cols}
          data={sortedExpenses}
          emptyMessage="No expenses recorded yet. Click “Add Expense” to start tracking your spending."
        />
      </div>

      {/* Add expense modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Expense">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Date *</span>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Amount (incl VAT) *</span>
              <input type="number" min="0" step="0.01" value={form.amount} placeholder="0.00"
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Category *</span>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">Select category…</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Supplier</span>
            <input value={form.supplier} placeholder="e.g. Eskom, Makro, landlord…"
              onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
            <input type="checkbox" checked={form.vatable}
              onChange={e => setForm(f => ({ ...f, vatable: e.target.checked }))}
              className="h-4 w-4 accent-primary" />
            <span className="text-sm text-slate-700">Supplier is VAT-registered (claim input VAT)</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Notes</span>
            <input value={form.notes} placeholder="Optional"
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <button onClick={saveExpense} disabled={saving}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
