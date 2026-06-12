// Two-way SMS inbox. Inbound replies arrive via the smsInboundWebhook Cloud
// Function (BulkSMS relay) into users/{uid}/inbox. Replies sent from here are
// operational messages — they do not consume the campaign quota.

import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import { updateDoc, deleteDoc, doc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { MessageSquare, Send, Loader2, Trash2, Phone, CornerUpLeft, CheckCheck } from 'lucide-react'

const CONTACT_COLLECTION = { medical: 'patients', b2b: 'customers', property: 'tenants', retail: 'customers' }

function contactName(c) {
  return c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || null
}

function normPhone(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  if (d.startsWith('27') && d.length === 11) return '+' + d
  if (d.startsWith('0') && d.length === 10) return '+27' + d.slice(1)
  if (d.length === 9) return '+27' + d
  return '+' + d
}

export default function InboxModule({ industry }) {
  const { user } = useAuth()
  const uid = user?.uid
  const inbox    = useCollection(uid ? `users/${uid}/inbox` : null)
  const contacts = useCollection(uid ? `users/${uid}/${CONTACT_COLLECTION[industry] ?? 'customers'}` : null)

  const [selected, setSelected]   = useState(null)
  const [reply,    setReply]      = useState('')
  const [sending,  setSending]    = useState(false)

  // Map phone → contact name so replies show who wrote in
  const nameByPhone = useMemo(() => {
    const map = {}
    contacts.forEach(c => {
      const p = normPhone(c.phone)
      const n = contactName(c)
      if (p && n) map[p] = n
    })
    return map
  }, [contacts])

  const sorted = useMemo(
    () => [...inbox].sort((a, b) => (b.receivedAt?.toMillis?.() ?? 0) - (a.receivedAt?.toMillis?.() ?? 0)),
    [inbox]
  )
  const unreadCount = inbox.filter(m => !m.read).length
  const selectedMsg = sorted.find(m => m.id === selected) ?? null

  function openMessage(m) {
    setSelected(m.id)
    setReply('')
    if (!m.read) updateDoc(doc(db, 'users', uid, 'inbox', m.id), { read: true }).catch(() => {})
  }

  async function sendReply() {
    if (!selectedMsg || !reply.trim() || sending) return
    setSending(true)
    try {
      const res = await httpsCallable(functions, 'sendSMS')({ to: selectedMsg.from, message: reply.trim() })
      if (!res.data?.success) throw new Error(res.data?.error || 'SMS send failed')
      await Promise.all([
        addDoc(collection(db, 'users', uid, 'messages'), {
          to: selectedMsg.from, type: 'sms', body: reply.trim(),
          status: 'sent', module: 'inbox-reply', sentAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'users', uid, 'inbox', selectedMsg.id), {
          repliedAt: serverTimestamp(), lastReply: reply.trim(),
        }),
      ])
      setReply('')
    } catch (e) {
      alert('Failed to send reply: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Inbox</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            SMS replies from your contacts. Replies you send here don't use your campaign quota.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
            {unreadCount} unread
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card">
          <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No replies yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            When contacts reply to your SMS campaigns or reminders, their messages will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1.4fr] items-start">
          {/* Message list */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {sorted.map(m => {
                const name = nameByPhone[m.from] || m.from
                const active = selected === m.id
                return (
                  <button key={m.id} onClick={() => openMessage(m)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                      active ? 'bg-primary/5' : 'hover:bg-slate-50'
                    }`}>
                    <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      m.read ? 'bg-slate-100 text-slate-500' : 'bg-primary/10 text-primary'
                    }`}>
                      {(name || '?').replace('+27', '').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${m.read ? 'font-medium text-slate-600' : 'font-bold text-slate-900'}`}>{name}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {m.receivedAt?.toDate?.()?.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) ?? ''}
                        </span>
                      </div>
                      <p className={`truncate text-xs ${m.read ? 'text-slate-400' : 'text-slate-600'}`}>{m.body}</p>
                    </div>
                    {!m.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Detail + reply */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            {!selectedMsg ? (
              <div className="px-6 py-20 text-center">
                <CornerUpLeft size={26} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">Select a message to read and reply.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">
                      {nameByPhone[selectedMsg.from] || selectedMsg.from}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Phone size={10} /> {selectedMsg.from}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this message?')) {
                        deleteDoc(doc(db, 'users', uid, 'inbox', selectedMsg.id))
                        setSelected(null)
                      }
                    }}
                    className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="space-y-3 px-5 py-5">
                  <div className="flex">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      {selectedMsg.body}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Received {selectedMsg.receivedAt?.toDate?.()?.toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) ?? ''}
                  </p>
                  {selectedMsg.lastReply && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-white">
                        {selectedMsg.lastReply}
                        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">
                          <CheckCheck size={11} /> replied
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 p-4">
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Type your reply…"
                      rows={2}
                      className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button onClick={sendReply} disabled={!reply.trim() || sending}
                      className="flex shrink-0 items-center gap-2 self-end rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-40">
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Reply
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">{reply.length} chars · sent as SMS</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
