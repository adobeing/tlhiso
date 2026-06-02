import { forwardRef } from 'react'

export const Field = forwardRef(function Field(
  { label, error, type = 'text', ...rest }, ref,
) {
  return (
    <label className="block">
      <span className="label-caps mb-1.5 block text-xs text-ink-secondary">{label}</span>
      <input
        ref={ref}
        type={type}
        className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-sm outline-none transition
          focus:ring-2 focus:ring-primary/40 ${error ? 'border-alert-red' : 'border-border focus:border-primary'}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-alert-red">{error}</span>}
    </label>
  )
})

export function Button({ children, loading, variant = 'primary', ...rest }) {
  const base = 'w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60'
  const styles = {
    primary: 'bg-primary text-white hover:bg-[#4e7d6d]',
    ghost: 'border border-border bg-surface text-ink hover:bg-surface-2',
  }
  return (
    <button className={`${base} ${styles[variant]}`} disabled={loading} {...rest}>
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <div className="rounded-xl border border-alert-red/30 bg-alert-red/5 px-4 py-3 text-sm text-alert-red">
      {children}
    </div>
  )
}
