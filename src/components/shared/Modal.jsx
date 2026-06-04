import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizeMap[size]} rounded-3xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-secondary transition hover:bg-surface-2 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
