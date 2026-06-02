export default function StatCard({ label, value, icon, trend, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary-light text-primary',
    orange: 'bg-orange-50 text-orange-500',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">{label}</p>
        {icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${colorMap[color] ?? colorMap.primary}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-extrabold text-ink">{value}</p>
      {trend && <p className="mt-1 text-xs text-ink-secondary">{trend}</p>}
    </div>
  )
}
