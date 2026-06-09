// Shared Google Calendar–style appointment view.
// Used by all 4 industry dashboards — each dashboard passes its own
// booking-form callback and list columns; this component owns the calendar.
import React, { useState, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, LayoutList } from 'lucide-react'
import DataTable from './DataTable'

// ── Constants ─────────────────────────────────────────────────────────────────
const CAL_START   = 7
const CAL_END     = 20
const SLOT_H      = 60   // px per hour
const CAL_TOTAL_H = (CAL_END - CAL_START) * SLOT_H
const CAL_HOURS   = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i)
const DAY_LABELS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const APPT_STATUS = ['Scheduled', 'Confirmed', 'Arrived', 'Completed', 'Cancelled', 'No-show']

export const BLOCK_COLORS = {
  Scheduled: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
  Confirmed: { bg: '#F0FDF4', border: '#16A34A', text: '#15803D' },
  Arrived:   { bg: '#FAF5FF', border: '#9333EA', text: '#7E22CE' },
  Completed: { bg: '#F0FDF4', border: '#5B8E7D', text: '#166534' },
  Cancelled: { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C' },
  'No-show': { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' },
}

export const BADGE_COLORS = {
  Scheduled:  'bg-blue-50 text-blue-700',
  Confirmed:  'bg-green-50 text-green-700',
  Arrived:    'bg-purple-50 text-purple-700',
  Completed:  'bg-primary-light text-primary',
  Cancelled:  'bg-red-50 text-red-600',
  'No-show':  'bg-orange-50 text-orange-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function toMins(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function fmtHour(h) {
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function fmtDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

// ── Appointment block ─────────────────────────────────────────────────────────
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
        top: top + 1,
        height,
        left:  `calc(${col * pct}% + 2px)`,
        width: `calc(${pct}% - 4px)`,
        backgroundColor: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
      }}
      className="rounded-md px-1.5 py-0.5 text-left overflow-hidden shadow-sm hover:brightness-95 transition-all"
    >
      <p className="text-[10px] font-bold leading-tight truncate">{appt.time} — {appt.customer || appt.patient}</p>
      {height > 32 && (
        <p className="text-[9px] leading-tight opacity-75 truncate">
          {appt.service || appt.purpose || appt.appointmentType || appt.reason || ''}
        </p>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AppointmentCalendar({
  appointments,       // live collection array
  onSlotClick,        // (dateStr, hour) => void — user clicked empty slot
  onApptClick,        // (appt) => void — user clicked an appointment block
  listColumns,        // DataTable columns for list view
  title    = 'Appointments',
  subtitle,
  emptyMessage = 'No appointments yet.',
  headerAction,       // ReactNode — "Book Appointment" button from parent
}) {
  const scrollRef = useRef(null)
  const todayStr  = useMemo(() => fmtDateStr(new Date()), [])

  const [calView,  setCalView]  = useState('week')
  const [mainView, setMainView] = useState('calendar')
  const [anchor,   setAnchor]   = useState(() => getWeekStart(new Date()))

  const days = useMemo(() =>
    calView === 'week' ? getWeekDays(anchor) : [anchor],
    [calView, anchor]
  )

  // Scroll to current time on calendar mount
  useMemo(() => {
    setTimeout(() => {
      if (!scrollRef.current) return
      const now = new Date()
      const top = ((now.getHours() * 60 + now.getMinutes()) - CAL_START * 60) / 60 * SLOT_H - 100
      scrollRef.current.scrollTop = Math.max(0, top)
    }, 80)
  }, [mainView])

  function navPrev() {
    const d = new Date(anchor); d.setDate(d.getDate() - (calView === 'week' ? 7 : 1)); setAnchor(d)
  }
  function navNext() {
    const d = new Date(anchor); d.setDate(d.getDate() + (calView === 'week' ? 7 : 1)); setAnchor(d)
  }
  function goToday() {
    if (calView === 'week') setAnchor(getWeekStart(new Date()))
    else { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d) }
  }
  function switchCalView(v) {
    setCalView(v)
    if (v === 'day') { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d) }
    else setAnchor(getWeekStart(new Date()))
  }

  const rangeLabel = useMemo(() => {
    if (calView === 'day') return anchor.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const ws = days[0]; const we = days[6]
    return ws.getMonth() === we.getMonth()
      ? `${ws.getDate()}–${we.getDate()} ${ws.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`
      : `${ws.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – ${we.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [calView, anchor, days])

  const apptsByDate = useMemo(() => {
    const map = {}
    appointments.forEach(a => { if (!map[a.date]) map[a.date] = []; map[a.date].push(a) })
    return map
  }, [appointments])

  const todayCount = (apptsByDate[todayStr] || []).length
  const upcoming   = appointments.filter(a => a.status === 'Scheduled' || a.status === 'Confirmed').length

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const nowTop  = (nowMins - CAL_START * 60) / 60 * SLOT_H
  const showNow = nowTop >= 0 && nowTop < CAL_TOTAL_H

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-ink-secondary">
            {subtitle || `${todayCount} today · ${upcoming} upcoming`}
          </p>
        </div>
        {headerAction}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={goToday}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-2">
            Today
          </button>
          <div className="flex">
            <button onClick={navPrev} className="rounded-l-lg border border-border p-1.5 text-ink transition hover:bg-surface-2">
              <ChevronLeft size={15} />
            </button>
            <button onClick={navNext} className="rounded-r-lg border-y border-r border-border p-1.5 text-ink transition hover:bg-surface-2">
              <ChevronRight size={15} />
            </button>
          </div>
          <span className="text-sm font-semibold text-ink">{rangeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }].map(v => (
              <button key={v.key} onClick={() => switchCalView(v.key)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${calView === v.key ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-surface-2'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button onClick={() => setMainView('calendar')} title="Calendar"
              className={`p-2 transition ${mainView === 'calendar' ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-surface-2'}`}>
              <CalendarDays size={14} />
            </button>
            <button onClick={() => setMainView('list')} title="List"
              className={`border-l border-border p-2 transition ${mainView === 'list' ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-surface-2'}`}>
              <LayoutList size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* List view */}
      {mainView === 'list' && (
        <DataTable columns={listColumns} data={appointments} emptyMessage={emptyMessage} />
      )}

      {/* Calendar view */}
      {mainView === 'calendar' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm select-none">

          {/* Day headers */}
          <div className="flex border-b border-border bg-white sticky top-0 z-10">
            <div className="w-[52px] flex-shrink-0 border-r border-border flex items-end justify-center pb-2">
              <span className="text-[9px] font-semibold text-ink-secondary">SAST</span>
            </div>
            {days.map((d, i) => {
              const ds      = fmtDateStr(d)
              const isToday = ds === todayStr
              const count   = (apptsByDate[ds] || []).length
              return (
                <div key={i} className={`flex-1 border-r last:border-r-0 border-border py-2 flex flex-col items-center gap-0.5 ${isToday ? 'bg-primary-light/20' : ''}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? 'text-primary' : 'text-ink-secondary'}`}>
                    {DAY_LABELS[i % 7]}
                  </p>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isToday ? 'bg-primary text-white' : 'text-ink'}`}>
                    {d.getDate()}
                  </div>
                  {count > 0 && (
                    <span className={`text-[9px] font-semibold ${isToday ? 'text-primary' : 'text-ink-secondary'}`}>
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
              <div className="w-[52px] flex-shrink-0 border-r border-border relative" style={{ height: CAL_TOTAL_H }}>
                {CAL_HOURS.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - CAL_START) * SLOT_H - 8, right: 6 }}>
                    <span className="text-[10px] text-ink-secondary/70 font-medium whitespace-nowrap">
                      {fmtHour(h)}
                    </span>
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
                    className={`flex-1 border-r last:border-r-0 border-border relative ${isToday ? 'bg-blue-50/20' : 'bg-white'}`}
                    style={{ height: CAL_TOTAL_H }}
                    onClick={e => {
                      const rect  = e.currentTarget.getBoundingClientRect()
                      const clickY = e.clientY - rect.top + e.currentTarget.parentElement.parentElement.scrollTop
                      const h = Math.floor(clickY / SLOT_H) + CAL_START
                      if (h >= CAL_START && h < CAL_END) onSlotClick?.(ds, h)
                    }}
                  >
                    {/* Hour lines */}
                    {CAL_HOURS.map(h => (
                      <div key={h} style={{ position: 'absolute', top: (h - CAL_START) * SLOT_H, left: 0, right: 0 }}
                        className="border-t border-border/40" />
                    ))}
                    {/* Half-hour lines */}
                    {CAL_HOURS.map(h => (
                      <div key={`${h}h`} style={{ position: 'absolute', top: (h - CAL_START) * SLOT_H + SLOT_H / 2, left: 0, right: 0 }}
                        className="border-t border-dashed border-border/25" />
                    ))}

                    {/* Now indicator */}
                    {isToday && showNow && (
                      <div style={{ position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 5 }}
                        className="pointer-events-none flex items-center">
                        <div className="h-[9px] w-[9px] rounded-full bg-red-500 flex-shrink-0 -ml-[5px]" />
                        <div className="h-[2px] flex-1 bg-red-500" />
                      </div>
                    )}

                    {/* Appointment blocks */}
                    {dayAppts.map(a => (
                      <CalApptBlock key={a.id} appt={a} layout={layouts[a.id]} onClick={onApptClick} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 bg-surface-2/40 px-4 py-2.5">
            {APPT_STATUS.map(s => {
              const c = BLOCK_COLORS[s] || { border: '#9CA3AF', bg: '#F9FAFB', text: '#374151' }
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
    </div>
  )
}
