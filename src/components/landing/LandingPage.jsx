import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { INDUSTRY_LIST } from '../../utils/industries'

const FEATURES = {
  b2b: [
    { icon: '📋', title: 'Client Management', desc: 'Track all your client accounts, contacts, and communication history in one place.' },
    { icon: '🧾', title: 'Invoicing & Quotations', desc: 'Create professional invoices with VAT, send via email, SMS or WhatsApp.' },
    { icon: '📁', title: 'Projects & Tasks', desc: 'Manage projects with deadlines, milestones, and progress tracking.' },
    { icon: '📣', title: 'Email & SMS Campaigns', desc: 'Reach your clients with targeted marketing campaigns at scale.' },
  ],
  medical: [
    { icon: '🩺', title: 'Patient Records', desc: 'Comprehensive patient profiles with medical history, allergies, and chronic conditions.' },
    { icon: '🎙️', title: 'Audio Transcription', desc: 'Record consultations and auto-transcribe using AI — no note-taking needed.' },
    { icon: '📄', title: 'Referral Letters', desc: 'Generate and track specialist referrals with branded PDF export.' },
    { icon: '📅', title: 'Appointment Calendar', desc: 'Multi-practitioner scheduling with automated patient SMS reminders.' },
  ],
  property: [
    { icon: '🏘️', title: 'Property Register', desc: 'Manage your full portfolio with occupancy, financials, and maintenance in one view.' },
    { icon: '📁', title: 'Tenant Documents', desc: 'Store lease agreements, IDs, and proof of income securely in the cloud.' },
    { icon: '🔧', title: 'Maintenance Log', desc: 'Track maintenance requests, assign contractors, and close out issues.' },
    { icon: '💵', title: 'Rent Roll & Statements', desc: 'Track payments, arrears, and auto-generate owner statements as PDF.' },
  ],
  retail: [
    { icon: '💇', title: 'Customer Bookings', desc: 'Calendar-based appointment booking with confirmations and reminders.' },
    { icon: '🏷️', title: 'Weekly Deals', desc: 'Create promotional deals and blast them to opted-in customers instantly.' },
    { icon: '📊', title: 'Customer Insights', desc: 'Track customer visits, spend patterns, and birthdays for personalised outreach.' },
    { icon: '⭐', title: 'Feedback Surveys', desc: 'Collect customer satisfaction scores after every visit automatically.' },
  ],
  events: [
    { icon: '👥', title: 'Guest Management', desc: 'Add guests manually or import via CSV with company, table number, and job title.' },
    { icon: '📧', title: 'Invitations & RSVPs', desc: 'Send branded email + SMS invites with personal RSVP links — guests confirm in one tap.' },
    { icon: '📋', title: 'Agenda Builder', desc: 'Build a detailed event programme displayed on every guest\'s personal invite page.' },
    { icon: '✅', title: 'Check-in & Name Tags', desc: 'Real-time guest check-in with QR codes and printable name tag PDFs — no extra apps.' },
  ],
}

const TESTIMONIALS = [
  {
    name: 'Naledi Khumalo',
    role: 'Medical Rep',
    company: 'Khumalo Surgical Supplies',
    industry: 'B2B',
    quote: 'The B2B mode lets me manage all my client accounts, track who I\'ve contacted, and send professional follow-ups in minutes.',
    stars: 5,
  },
  {
    name: 'Dr. Thabo Sithole',
    role: 'General Practitioner',
    company: 'Sithole Family Practice',
    industry: 'Medical',
    quote: 'The audio transcription alone saves me 45 minutes per day. My patients love the automated reminders.',
    stars: 5,
  },
  {
    name: 'Yolanda van der Berg',
    role: 'Property Manager',
    company: 'Cape Coastal Properties',
    industry: 'Property',
    quote: 'Managing 40+ units used to be a nightmare. Now I send statements to all tenants with one click.',
    stars: 5,
  },
  {
    name: 'Bongani Mokoena',
    role: 'Owner',
    company: 'Bongz Barbershop, Soweto',
    industry: 'Retail',
    quote: 'The weekly deals feature doubled my walk-ins. I send a WhatsApp blast Monday morning and I\'m fully booked by Wednesday.',
    stars: 5,
  },
  {
    name: 'Lerato Dlamini',
    role: 'Corporate Event Planner',
    company: 'Signature Events, Johannesburg',
    industry: 'Events',
    quote: 'I launched a 300-person gala in under an hour — invites, RSVPs, agenda, seating, and QR check-in, all from one place.',
    stars: 5,
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: '699',
    messages: '1,000',
    tag: null,
    idealFor: null,
    features: [
      '1,000 campaign messages/mo (SMS + email)',
      'Campaigns — not counted: bookings & reminders',
      'All industry dashboards included',
      'Customer / patient / tenant management',
      'Appointments & bookings (unlimited)',
      'Invoicing, statements & POPIA module',
    ],
    cta: 'Get Started',
    href: '/register',
    popular: false,
  },
  {
    name: 'Professional',
    price: '2,699',
    messages: '3,000',
    tag: 'Most popular',
    idealFor: 'Ideal for medical practices & doctors',
    features: [
      '3,000 campaign messages/mo (SMS + email)',
      'Campaigns — not counted: bookings & reminders',
      'Everything in Starter',
      'Audio consultation recording & transcription',
      'Medical reports & referral PDFs',
      'Survey builder & WhatsApp campaigns',
    ],
    cta: 'Get Started',
    href: '/register',
    popular: true,
  },
  {
    name: 'Business',
    price: '4,999',
    messages: '10,000',
    tag: null,
    idealFor: 'Ideal for B2B companies & property managers',
    features: [
      '10,000 campaign messages/mo (SMS + email)',
      'Campaigns — not counted: bookings & reminders',
      'Everything in Professional',
      'Dedicated account manager',
      'Priority support & SLA guarantee',
      'Custom integrations on request',
    ],
    cta: 'Contact Us',
    href: 'mailto:hello@tlhiso.com',
    popular: false,
  },
]

const STATS = [
  { value: '5', label: 'Industry verticals' },
  { value: '3', label: 'Messaging channels' },
  { value: '10k', label: 'Campaign messages / month' },
  { value: '100%', label: 'South African' },
]

function Stars({ count }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-amber-400 text-sm">★</span>
      ))}
    </div>
  )
}

const GOALS = [
  'Drive sales revenue',
  'Save time with automation',
  'Attract more customers',
  'Optimise marketing performance',
  'Send SMS campaigns',
  'Manage customer relationships',
  'Design effective emails',
  'Switch from another tool',
]

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('b2b')

  // Personalisation popup
  const [popupStep,       setPopupStep]       = useState(null)   // null | 1 | 2
  const [selIndustry,     setSelIndustry]     = useState(null)
  const [selGoals,        setSelGoals]        = useState([])

  useEffect(() => {
    if (localStorage.getItem('tlhiso_pref')) return
    const t = setTimeout(() => setPopupStep(1), 2500)
    return () => clearTimeout(t)
  }, [])

  function dismissPopup() {
    localStorage.setItem('tlhiso_pref', '1')
    setPopupStep(null)
  }

  function toggleGoal(g) {
    setSelGoals(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 3 ? [...prev, g] : prev
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <img src="/tlhiso-logo.png" alt="Tlhiso" className="h-8 w-auto" />
          <div className="hidden items-center gap-8 text-sm font-medium text-ink-secondary md:flex">
            <a href="#features" className="transition hover:text-primary">Features</a>
            <a href="#testimonials" className="transition hover:text-primary">Reviews</a>
            <a href="#pricing" className="transition hover:text-primary">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"
              className="text-sm font-semibold text-ink-secondary transition hover:text-ink">
              Sign in
            </Link>
            <Link to="/register"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4e7d6d]">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f0f9f5] to-white px-6 pb-20 pt-24">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-64 -top-64 h-[500px] w-[500px] rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-primary/6 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-light px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Built for South African businesses
          </div>

          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-ink md:text-6xl lg:text-7xl">
            Run Your Business.<br />
            <span className="text-primary">Smarter.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-secondary">
            One platform for Medical practices, Property managers, B2B companies, Consumer businesses, and Event Planners.
            Messaging, invoicing, scheduling — all in one place.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/register"
              className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:bg-[#4e7d6d] hover:shadow-lg hover:shadow-primary/30">
              Get started
            </Link>
            <a href="#features"
              className="rounded-full border border-border bg-white px-8 py-3.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-2">
              See features ↓
            </a>
          </div>

          <p className="mt-4 text-xs text-ink-secondary/70">No credit card required · Cancel anytime</p>
        </div>

        {/* Stats strip */}
        <div className="relative mx-auto mt-20 max-w-3xl">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {STATS.map(s => (
              <div key={s.label} className="rounded-2xl border border-border/60 bg-white px-5 py-4 text-center shadow-sm">
                <p className="text-2xl font-extrabold tracking-tight text-primary">{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-ink-secondary">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust stats strip ── */}
      <section className="border-y border-border/60 bg-white px-6 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {[
            { value: '500+',  label: 'SA businesses' },
            { value: '2M+',   label: 'Messages delivered' },
            { value: '5',     label: 'Industries served' },
            { value: '4.9★',  label: 'Average rating' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold tracking-tight text-primary">{s.value}</p>
              <p className="mt-1 text-sm text-ink-secondary">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Industries ── */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Five verticals. One platform.</p>
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Built for your industry</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRY_LIST.map((ind) => (
              <div key={ind.key}
                className="group flex flex-col rounded-3xl border border-border/70 bg-white p-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover">
                <span className="text-4xl">{ind.icon}</span>
                <h3 className="mt-4 text-base font-bold text-ink">{ind.label}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{ind.description}</p>
                <Link to="/register"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary transition hover:gap-2">
                  Get started <span>→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-surface-2 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">What you get</p>
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Industry-specific features</h2>
          </div>

          {/* Tab bar */}
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {INDUSTRY_LIST.map((ind) => (
              <button key={ind.key} onClick={() => setActiveTab(ind.key)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  activeTab === ind.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'border border-border bg-white text-ink-secondary hover:border-primary/40 hover:text-ink'
                }`}>
                {ind.icon} {ind.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES[activeTab].map((f, i) => (
              <div key={f.title}
                className="rounded-3xl border border-border/70 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-sm font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Messaging channels strip ── */}
      <section className="border-y border-border/60 bg-white px-6 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-8 text-xs font-semibold uppercase tracking-widest text-primary">Three channels. One inbox.</p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {[
              { icon: '💬', label: 'SMS', sub: 'Instant delivery', color: 'bg-blue-50 text-blue-600' },
              { icon: '✉️', label: 'Email', sub: 'Branded & professional', color: 'bg-emerald-50 text-emerald-700' },
              { icon: '📱', label: 'WhatsApp', sub: 'Coming soon', color: 'bg-green-50 text-green-600' },
            ].map(ch => (
              <div key={ch.label} className="flex flex-col items-center gap-2">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${ch.color}`}>
                  {ch.icon}
                </div>
                <p className="text-sm font-bold text-ink">{ch.label}</p>
                <p className="text-xs text-ink-secondary">{ch.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Events callout ── */}
      <section className="bg-gradient-to-br from-[#f0f9f5] to-white px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left — copy */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary-light px-4 py-1.5 text-xs font-semibold text-primary">
                🎪 New — Events vertical
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
                Host any event.<br />
                <span className="text-primary">Pay per guest.</span>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-secondary">
                No subscription required. Create your event, add guests, and pay only when you launch —
                <strong className="text-ink"> R6 per guest + 15% VAT</strong>. Covers up to 3 touchpoints
                per guest: invite, reminder, and thank-you.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  { icon: '📧', text: 'Branded email + SMS invitations with personal RSVP links' },
                  { icon: '📋', text: 'Agenda builder displayed on every guest\'s invite page' },
                  { icon: '🗺️', text: 'Google Maps embed so guests get directions in one tap' },
                  { icon: '🔲', text: 'QR codes per guest for contactless check-in at the door' },
                  { icon: '🏷️', text: 'Printable name tag PDFs — A4 landscape, 4 per page' },
                  { icon: '🏢', text: 'Corporate fields: company, job title, table assignment, dress code' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-ink">
                    <span className="mt-0.5 flex-shrink-0 text-base">{icon}</span>
                    {text}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-3">
                <Link to="/register"
                  className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4e7d6d]">
                  Host an event
                </Link>
                <Link to="/login"
                  className="rounded-full border border-border bg-white px-7 py-3 text-sm font-semibold text-ink transition hover:bg-surface-2">
                  Sign in →
                </Link>
              </div>
            </div>

            {/* Right — rate card */}
            <div className="rounded-3xl border border-border/70 bg-white p-8 shadow-card">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
              <p className="text-3xl font-extrabold tracking-tight text-ink">R6 <span className="text-lg font-normal text-ink-secondary">/ guest</span></p>
              <p className="mt-1 text-sm text-ink-secondary">+ 15% VAT · paid once at launch · no monthly fee</p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-left text-xs font-bold uppercase tracking-wider text-ink-secondary">
                      <th className="px-5 py-3">Guests</th>
                      <th className="px-5 py-3">Total (incl. VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {[
                      { guests: '50',   total: 'R345' },
                      { guests: '100',  total: 'R690' },
                      { guests: '300',  total: 'R2,070' },
                      { guests: '500',  total: 'R3,450' },
                      { guests: '1,000', total: 'R6,900' },
                    ].map(row => (
                      <tr key={row.guests} className="hover:bg-surface-2/50">
                        <td className="px-5 py-3 font-semibold text-ink">{row.guests}</td>
                        <td className="px-5 py-3 font-bold text-primary">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-ink-secondary">
                Each guest fee covers up to 3 touchpoints — invite, reminder, and thank-you — via email and SMS.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="bg-surface-2 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Real customers</p>
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Loved by South African businesses</h2>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-amber-400 text-lg">★</span>
                ))}
              </div>
              <p className="text-sm font-semibold text-ink">4.9 / 5</p>
              <p className="text-sm text-ink-secondary">· Rated by 200+ verified SA businesses</p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t) => (
              <div key={t.name}
                className="flex flex-col justify-between rounded-3xl border border-border/70 bg-white p-6 shadow-card">
                <div>
                  <div className="flex items-center justify-between">
                    <Stars count={t.stars} />
                    <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      {t.industry}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink">"{t.quote}"</p>
                </div>
                <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                    {t.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{t.name}</p>
                    <p className="truncate text-[11px] text-ink-secondary">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Simple pricing</p>
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Choose your plan</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm text-ink-secondary">Campaign message quota counts SMS + email campaigns only. Booking confirmations, appointment reminders, and operational messages are always free and unlimited.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name}
                className={`relative flex flex-col rounded-3xl border p-8 shadow-card transition-shadow hover:shadow-card-hover ${
                  p.popular
                    ? 'border-primary bg-white ring-2 ring-primary ring-offset-4'
                    : 'border-border/70 bg-white'
                }`}>
                {p.popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                    Most popular
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-secondary">{p.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-ink">R{p.price}</span>
                  <span className="text-sm text-ink-secondary">/mo</span>
                </div>
                <p className="mt-1 text-xs font-medium text-primary">{p.messages} campaign messages / month</p>
                {p.idealFor && (
                  <p className="mt-1 text-[11px] text-ink-secondary italic">{p.idealFor}</p>
                )}

                <ul className="mt-7 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
                      <span className="mt-0.5 flex-shrink-0 text-primary font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <a href={p.href}
                  className={`mt-8 block rounded-full px-4 py-3 text-center text-sm font-semibold transition ${
                    p.popular
                      ? 'bg-primary text-white shadow-sm hover:bg-[#4e7d6d]'
                      : 'border border-border text-ink hover:bg-surface-2'
                  }`}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="bg-primary px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Ready to run your business smarter?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
            Join hundreds of South African businesses already using Tlhiso. No credit card required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register"
              className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-surface-2">
              Get started
            </Link>
            <a href="mailto:hello@tlhiso.com"
              className="rounded-full border border-white/40 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
              Talk to sales
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/60 bg-white px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <img src="/tlhiso-logo.png" alt="Tlhiso" className="h-8 w-auto" />
              <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
                Run your business. Smarter.<br />Built for South Africa.
              </p>
              <a href="mailto:hello@tlhiso.com"
                className="mt-4 inline-block text-sm font-medium text-primary transition hover:underline">
                hello@tlhiso.com
              </a>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-secondary">Product</p>
              <ul className="space-y-2.5 text-sm text-ink-secondary">
                <li><a href="#features" className="transition hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="transition hover:text-primary">Pricing</a></li>
                <li><Link to="/register" className="transition hover:text-primary">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-secondary">Industries</p>
              <ul className="space-y-2.5 text-sm text-ink-secondary">
                {INDUSTRY_LIST.map((ind) => (
                  <li key={ind.key}>
                    <Link to="/register" className="transition hover:text-primary">{ind.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-secondary">Legal</p>
              <ul className="space-y-2.5 text-sm text-ink-secondary">
                <li><Link to="/legal/terms" className="transition hover:text-primary">Terms of Service</Link></li>
                <li><Link to="/legal/privacy" className="transition hover:text-primary">Privacy Policy</Link></li>

              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-8 text-xs text-ink-secondary/70 md:flex-row">
            <p>© {new Date().getFullYear()} Tlhiso. All rights reserved.</p>
            <p>
              Protected by reCAPTCHA —{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="hover:text-primary">Privacy</a>
              {' & '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="hover:text-primary">Terms</a>
            </p>
          </div>
        </div>
      </footer>

      {/* ── Personalisation popup ─────────────────────────────────────────── */}
      {popupStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">

            {/* Progress bar */}
            <div className="h-1 w-full bg-gray-100">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: popupStep === 1 ? '50%' : '100%' }}
              />
            </div>

            <div className="p-6">
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1">
                    Step {popupStep} of 2
                  </p>
                  <h2 className="text-lg font-extrabold text-ink leading-snug">
                    {popupStep === 1
                      ? 'Make Tlhiso work for you'
                      : 'What do you want to achieve?'}
                  </h2>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {popupStep === 1
                      ? 'Which of the following best describes your industry?'
                      : 'Select up to 3 goals.'}
                  </p>
                </div>
                <button onClick={dismissPopup}
                  className="mt-0.5 shrink-0 rounded-lg p-1.5 text-ink-secondary hover:bg-gray-100 transition">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              {/* Step 1 — industry */}
              {popupStep === 1 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {INDUSTRY_LIST.map(ind => (
                    <button key={ind.key} type="button"
                      onClick={() => setSelIndustry(ind.key)}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition ${
                        selIndustry === ind.key
                          ? 'border-primary bg-primary-light ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/40 hover:bg-surface-2'
                      }`}>
                      <span className="text-xl">{ind.icon}</span>
                      <span className="text-xs font-bold text-ink leading-tight">{ind.label}</span>
                      <span className="text-[11px] text-ink-secondary leading-tight">{ind.description}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2 — goals */}
              {popupStep === 2 && (
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map(g => {
                    const active = selGoals.includes(g)
                    const maxed  = selGoals.length >= 3 && !active
                    return (
                      <button key={g} type="button"
                        onClick={() => toggleGoal(g)}
                        disabled={maxed}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition ${
                          active
                            ? 'border-primary bg-primary-light text-primary font-semibold'
                            : maxed
                              ? 'cursor-not-allowed border-border bg-gray-50 text-ink-secondary/50'
                              : 'border-border text-ink hover:border-primary/40 hover:bg-surface-2'
                        }`}>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                          active ? 'border-primary bg-primary' : 'border-gray-300'
                        }`}>
                          {active && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        {g}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="mt-5 flex items-center justify-between">
                <button onClick={dismissPopup}
                  className="text-xs text-ink-secondary hover:text-ink transition">
                  Skip for now
                </button>
                {popupStep === 1 ? (
                  <button
                    onClick={() => selIndustry && setPopupStep(2)}
                    disabled={!selIndustry}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
                    Next →
                  </button>
                ) : (
                  <Link
                    to={`/register?industry=${selIndustry}`}
                    onClick={dismissPopup}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#4e7d6d]">
                    Get started free →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
