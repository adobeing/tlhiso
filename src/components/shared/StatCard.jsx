const ICON_BG = {
  primary: 'bg-emerald-50 text-emerald-600',
  orange:  'bg-orange-50 text-orange-600',
  red:     'bg-red-50 text-red-600',
  blue:    'bg-blue-50 text-blue-600',
  purple:  'bg-purple-50 text-purple-600',
}

const BADGE_STYLE = {
  up:   'bg-emerald-50 text-emerald-600',
  down: 'bg-red-50 text-red-500',
  flat: 'bg-slate-100 text-slate-500',
}

export default function StatCard({ label, value, icon, trend, trendTone, color = 'primary' }) {
  const iconBg    = ICON_BG[color] ?? ICON_BG.primary
  const badgeCls  = BADGE_STYLE[trendTone] ?? BADGE_STYLE.flat

  return (
    <div className="group flex flex-col justify-between rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
      <div className="mb-6 flex items-start justify-between">
        {icon && (
          <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 ${iconBg}`}>
            {icon}
          </span>
        )}
        {trend && (
          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeCls}`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-4xl font-black tracking-tight text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  )
}
