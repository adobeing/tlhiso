export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary-light border-t-primary" />
      <p className="text-sm font-medium text-ink-secondary">{label}</p>
    </div>
  )
}
