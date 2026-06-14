import { Link } from 'react-router-dom'

// Shared two-pane auth layout: branded sage panel + form card.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-5/12 flex-col justify-between overflow-hidden bg-sidebar p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              'radial-gradient(60% 50% at 20% 10%, rgba(91,142,125,0.55), transparent 60%), radial-gradient(50% 40% at 90% 90%, rgba(91,142,125,0.35), transparent 55%)',
          }}
        />
        <Link to="/" className="relative z-10">
          <img src="/tlhiso-logo-white.png?v=3" alt="Tlhiso" className="h-9 w-auto" />
        </Link>
        <div className="relative z-10">
          <p className="text-3xl font-bold leading-tight text-white">
            Run Your Business.<br />Smarter.
          </p>
          <p className="mt-4 max-w-sm text-sm text-sidebar-text">
            One platform for Medical practices, Property managers, B2B companies,
            and Consumer businesses.
          </p>
        </div>
        <p className="relative z-10 text-xs text-sidebar-text">© Tlhiso · hello@tlhiso.com</p>
      </aside>

      <main className="flex w-full items-center justify-center px-6 py-12 lg:w-7/12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-block lg:hidden">
            <img src="/tlhiso-logo.png" alt="Tlhiso" className="h-8 w-auto" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-secondary">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-secondary">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
