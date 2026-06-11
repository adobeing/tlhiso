import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronRight, Rocket, X } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import { db } from '../../services/firebase'

const CHECKLIST = {
  b2b: [
    { label: 'Add your first client',          to: '/b2b/clients',    col: 'customers' },
    { label: 'Create your first invoice',       to: '/b2b/invoices',   col: 'invoices'  },
    { label: 'Launch your first campaign',      to: '/b2b/campaigns',  col: 'campaigns' },
    { label: 'Complete your business profile',  to: '/b2b/profile',    col: null        },
  ],
  medical: [
    { label: 'Add your first patient',          to: '/medical/patients',      col: 'patients'      },
    { label: 'Book your first appointment',     to: '/medical/appointments',  col: 'appointments'  },
    { label: 'Send your first campaign',        to: '/medical/campaigns',     col: 'campaigns'     },
    { label: 'Complete your practice profile',  to: '/medical/profile',       col: null            },
  ],
  property: [
    { label: 'Add your first property',         to: '/property/properties',   col: 'properties'   },
    { label: 'Add your first tenant',           to: '/property/tenants',      col: 'tenants'      },
    { label: 'Send your first campaign',        to: '/property/campaigns',    col: 'campaigns'    },
    { label: 'Complete your agency profile',    to: '/property/profile',      col: null           },
  ],
  retail: [
    { label: 'Add your first customer',         to: '/retail/customers',      col: 'customers'    },
    { label: 'Book your first appointment',     to: '/retail/appointments',   col: 'appointments' },
    { label: 'Launch your first campaign',      to: '/retail/campaigns',      col: 'campaigns'    },
    { label: 'Complete your business profile',  to: '/retail/profile',        col: null           },
  ],
}

export default function SetupChecklist({ industry }) {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const steps = CHECKLIST[industry]

  // Three collection-based steps (step[3] is always the profile check).
  // Hooks are called unconditionally — null path is handled inside useCollection.
  const c0 = useCollection(uid && steps?.[0]?.col ? `users/${uid}/${steps[0].col}` : null)
  const c1 = useCollection(uid && steps?.[1]?.col ? `users/${uid}/${steps[1].col}` : null)
  const c2 = useCollection(uid && steps?.[2]?.col ? `users/${uid}/${steps[2].col}` : null)

  if (!steps || profile?.setupChecklistDismissed) return null

  const profileDone = !!(profile?.phone && profile?.businessName)
  const done = [c0.length > 0, c1.length > 0, c2.length > 0, profileDone]
  const completedCount = done.filter(Boolean).length

  if (completedCount === 4) return null

  async function dismiss() {
    if (!uid) return
    try { await updateDoc(doc(db, 'users', uid), { setupChecklistDismissed: true }) }
    catch (e) { console.error('[SetupChecklist] dismiss failed', e) }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/20 bg-primary-light/60 px-4 py-2.5">
      {/* Label + progress */}
      <div className="flex shrink-0 items-center gap-2">
        <Rocket size={13} className="text-primary" />
        <span className="text-xs font-bold text-ink">Getting Started</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {completedCount}/4
        </span>
      </div>

      {/* Steps */}
      <div className="flex flex-1 flex-wrap gap-1.5">
        {steps.map((step, i) => {
          const isDone = done[i]
          return isDone ? (
            <span key={step.to} className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
              <CheckCircle2 size={10} /> {step.label}
            </span>
          ) : (
            <Link key={step.to} to={step.to}
              className="flex items-center gap-1 rounded-full border border-primary/25 bg-white px-2.5 py-0.5 text-[11px] font-medium text-primary transition hover:border-primary hover:bg-white/80">
              <Circle size={10} className="text-primary/40" /> {step.label}
            </Link>
          )
        })}
      </div>

      {/* Dismiss */}
      <button onClick={dismiss} title="Dismiss"
        className="shrink-0 rounded-lg p-1 text-ink-secondary/60 transition hover:text-ink-secondary">
        <X size={13} />
      </button>
    </div>
  )
}
