import { useState } from 'react'
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
]

const PLANS = [
  {
    name: 'Starter',
    price: '699',
    messages: '100',
    features: ['Campaigns & business management', 'Email & SMS messaging', 'Customer management', 'Basic reporting'],
    cta: 'Get Started',
    href: '/register',
    popular: false,
  },
  {
    name: 'Business',
    price: '2,699',
    messages: '50,000',
    features: ['Everything in Starter', 'IVR (voice calls)', 'Survey builder', 'WhatsApp messaging', 'Advanced analytics'],
    cta: 'Get Started',
    href: '/register',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '4,999',
    messages: '250,000',
    features: ['Everything in Business', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee', 'Priority support'],
    cta: 'Contact Us',
    href: 'mailto:hello@tlhiso.com',
    popular: false,
  },
]

const STATS = [
  { value: '4', label: 'Industry verticals' },
  { value: '3', label: 'Messaging channels' },
  { value: '250k', label: 'Messages / month' },
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

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('b2b')

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <span className="text-xl font-extrabold tracking-tight text-ink">Tlhiso</span>
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
            One platform for Medical practices, Property managers, B2B companies, and Consumer businesses.
            Messaging, invoicing, scheduling — all in one place.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/register"
              className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:bg-[#4e7d6d] hover:shadow-lg hover:shadow-primary/30">
              Start free trial
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

      {/* ── Industries ── */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Four verticals. One platform.</p>
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
              { icon: '💬', label: 'SMS', sub: 'via BulkSMS', color: 'bg-blue-50 text-blue-600' },
              { icon: '✉️', label: 'Email', sub: 'via SendGrid', color: 'bg-emerald-50 text-emerald-700' },
              { icon: '📱', label: 'WhatsApp', sub: 'via Twilio', color: 'bg-green-50 text-green-600' },
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

      {/* ── Testimonials ── */}
      <section id="testimonials" className="bg-surface-2 px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Real customers</p>
            <h2 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">Loved by South African businesses</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t) => (
              <div key={t.name}
                className="flex flex-col justify-between rounded-3xl border border-border/70 bg-white p-6 shadow-card">
                <div>
                  <Stars count={t.stars} />
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
            <p className="mx-auto mt-4 max-w-md text-sm text-ink-secondary">All plans include every industry vertical. Pay for messaging volume, not features.</p>
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
                <p className="mt-1 text-xs font-medium text-primary">{p.messages} messages / month</p>

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
              Start free trial
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
              <span className="text-xl font-extrabold tracking-tight text-ink">Tlhiso</span>
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
                <li>
                  <a href="https://github.com/adobeing" target="_blank" rel="noreferrer"
                    className="transition hover:text-primary">GitHub</a>
                </li>
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
    </div>
  )
}
