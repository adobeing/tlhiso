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
    <div className="rounded-card border border-primary/20 bg-primary-light shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-primary/15 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Rocket size={17} className="flex-shrink-0 text-primary" />
          <div>
            <p className="text-sm font-bold text-ink">Getting Started</p>
            <p className="text-xs text-ink-secondary">{completedCount} of 4 steps complete</p>
          </div>
        </div>
        <button
          onClick={dismiss}
          title="Dismiss"
          className="rounded-lg p-1 text-ink-secondary transition hover:bg-primary/10 hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(completedCount / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid gap-2 p-5 sm:grid-cols-2">
        {steps.map((step, i) => {
          const isDone = done[i]
          return (
            <Link
              key={step.to}
              to={step.to}
              onClick={isDone ? (e) => e.preventDefault() : undefined}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                isDone
                  ? 'cursor-default border-green-200 bg-green-50'
                  : 'border-primary/20 bg-white hover:border-primary hover:shadow-sm'
              }`}
            >
              {isDone
                ? <CheckCircle2 size={17} className="flex-shrink-0 text-green-500" />
                : <Circle size={17} className="flex-shrink-0 text-primary/40" />
              }
              <span className={isDone ? 'text-green-700 line-through' : 'font-medium text-ink'}>
                {step.label}
              </span>
              {!isDone && <ChevronRight size={14} className="ml-auto flex-shrink-0 text-ink-secondary" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
