export default function StatCard({ label, value, icon, trend, trendTone, color = 'primary' }) {
  const iconMap = {
    primary: 'bg-primary-light text-primary',
    orange:  'bg-orange-50 text-orange-500',
    red:     'bg-red-50 text-red-500',
    blue:    'bg-blue-50 text-blue-500',
    purple:  'bg-purple-50 text-purple-600',
  }
  const trendMap = {
    up:   'text-green-600',
    down: 'text-red-500',
    flat: 'text-ink-secondary',
  }
  return (
    <div className="group relative rounded-card border border-border bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-ink-secondary">{label}</p>
        {icon && (
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base ${iconMap[color] ?? iconMap.primary}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-[1.75rem] font-bold leading-none tracking-tight text-ink">{value}</p>
      {trend && (
        <p className={`mt-2 text-xs font-medium ${trendMap[trendTone] ?? 'text-ink-secondary'}`}>
          {trend}
        </p>
      )}
    </div>
  )
}
