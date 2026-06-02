import { useState } from 'react'
import { Link } from 'react-router-dom'
import { INDUSTRY_LIST } from '../../utils/industries'

const FEATURES = {
  b2b: [
    { icon: '📋', title: 'Client Management', desc: 'Track all your client accounts, contacts, and communication history in one place.' },
    { icon: '🧾', title: 'Invoicing & Quotations', desc: 'Create professional invoices with VAT, send via email, SMS or WhatsApp.' },
    { icon: '📊', title: 'Projects & Tasks', desc: 'Manage projects with a kanban board, deadlines, and progress tracking.' },
    { icon: '📣', title: 'Email & SMS Campaigns', desc: 'Reach your clients with targeted marketing campaigns at scale.' },
  ],
  medical: [
    { icon: '🩺', title: 'Patient Records', desc: 'Comprehensive patient profiles with medical history, allergies, and chronic conditions.' },
    { icon: '🔊', title: 'Audio Transcription', desc: 'Record consultations and auto-transcribe using AI — no note-taking needed.' },
    { icon: '📄', title: 'Referral Letters', desc: 'Generate and track specialist referrals with PDF export.' },
    { icon: '📅', title: 'Appointment Calendar', desc: 'Multi-practitioner scheduling with automated patient reminders.' },
  ],
  property: [
    { icon: '🗺️', title: 'Property Map', desc: 'Interactive map showing all your properties with occupancy status at a glance.' },
    { icon: '📁', title: 'Tenant Documents', desc: 'Store lease agreements, IDs, proof of income securely in the cloud.' },
    { icon: '🔧', title: 'Maintenance Log', desc: 'Track maintenance requests, assign contractors, and close out issues.' },
    { icon: '💵', title: 'Rent Statements', desc: 'Auto-generate and send monthly statements to all tenants.' },
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
    role: 'Medical Rep · Khumalo Surgical Supplies',
    industry: 'B2B',
    quote: 'I sell surgical equipment to hospitals. The B2B mode lets me manage all my client accounts, track who I\'ve contacted, and send professional follow-ups in minutes.',
    stars: 5,
  },
  {
    name: 'Dr. Thabo Sithole',
    role: 'General Practitioner · Sithole Family Practice',
    industry: 'Medical',
    quote: 'The audio transcription alone saves me 45 minutes per day. My patients love the automated reminders, and my reception staff loves the appointment calendar.',
    stars: 5,
  },
  {
    name: 'Yolanda van der Berg',
    role: 'Property Manager · Cape Coastal Properties',
    industry: 'Property',
    quote: 'Managing 40+ units used to be a nightmare. Now I send statements to all tenants with one click and track maintenance from my phone.',
    stars: 5,
  },
  {
    name: 'Bongani Mokoena',
    role: 'Owner · Bongz Barbershop, Soweto',
    industry: 'Retail',
    quote: 'The weekly deals feature doubled my walk-ins. I send a WhatsApp blast on Monday mornings and I\'m fully booked by Wednesday.',
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

function StarRating({ count }) {
  return <span className="text-amber-400">{'★'.repeat(count)}</span>
}

export default function LandingPage() {
  const [activeFeatureTab, setActiveFeatureTab] = useState('b2b')

  return (
    <div className="min-h-screen font-sans bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <span className="text-xl font-extrabold tracking-tight text-ink">Tlhiso</span>
          <div className="hidden gap-8 text-sm font-medium text-ink-secondary md:flex">
            <a href="#features" className="hover:text-primary">Features</a>
            <a href="#testimonials" className="hover:text-primary">Reviews</a>
            <a href="#pricing" className="hover:text-primary">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-ink hover:text-primary">Sign in</Link>
            <Link to="/register" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#f0f9f4] via-white to-[#fafaf8] px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-4 inline-flex items-center rounded-full border border-primary/30 bg-primary-light px-4 py-1.5 text-xs font-semibold text-primary">
            Built for South African businesses
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-ink md:text-6xl">
            Run Your Business.<br />
            <span className="text-primary">Smarter.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-secondary">
            One platform for Medical practices, Property managers, B2B companies, and Consumer businesses.
            Messaging, invoicing, scheduling &amp; compliance — all in one place.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/register"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:bg-[#4e7d6d]">
              Start Free Trial
            </Link>
            <a href="#features"
              className="rounded-xl border border-border bg-white px-6 py-3 text-sm font-semibold text-ink hover:bg-surface-2">
              See Demo ↓
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-secondary">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* INDUSTRY CARDS */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="label-caps mb-2 text-center text-xs text-ink-secondary">Four verticals. One platform.</p>
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">Built for your industry</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRY_LIST.map((ind) => (
              <div key={ind.key}
                className="group rounded-card border border-border p-6 shadow-card transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <span className="text-4xl">{ind.icon}</span>
                <h3 className="mt-4 text-base font-bold text-ink">{ind.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{ind.description}</p>
                <Link to="/register"
                  className="mt-4 inline-block text-sm font-semibold text-primary group-hover:underline">
                  Learn more →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-surface-2 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="label-caps mb-2 text-center text-xs text-ink-secondary">What you get</p>
          <h2 className="mb-10 text-center text-3xl font-bold text-ink">Industry-specific features</h2>
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {INDUSTRY_LIST.map((ind) => (
              <button key={ind.key} onClick={() => setActiveFeatureTab(ind.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeFeatureTab === ind.key
                    ? 'bg-primary text-white'
                    : 'bg-white border border-border text-ink-secondary hover:border-primary/50'
                }`}>
                {ind.icon} {ind.label}
              </button>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES[activeFeatureTab].map((f) => (
              <div key={f.title} className="rounded-card border border-border bg-white p-6 shadow-card">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-3 text-base font-bold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="bg-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="label-caps mb-2 text-center text-xs text-ink-secondary">Don't just take our word for it</p>
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">Loved by South African businesses</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TESTIMONIALS.map((t) => (
              <div key={t.name}
                className="flex flex-col justify-between rounded-card border border-border p-6 shadow-card">
                <div>
                  <StarRating count={t.stars} />
                  <p className="mt-3 text-sm leading-relaxed text-ink">"{t.quote}"</p>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">{t.name}</p>
                    <p className="text-[11px] text-ink-secondary">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-surface-2 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="label-caps mb-2 text-center text-xs text-ink-secondary">Simple pricing</p>
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">Choose Your Plan</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name}
                className={`relative flex flex-col rounded-card border p-8 shadow-card ${
                  p.popular
                    ? 'border-primary bg-white ring-2 ring-primary ring-offset-2'
                    : 'border-border bg-white'
                }`}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-ink">R{p.price}</span>
                  <span className="mb-1 text-sm text-ink-secondary">/mo</span>
                </div>
                <p className="mt-1 text-xs text-ink-secondary">{p.messages} messages/month</p>
                <ul className="mt-6 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink">
                      <span className="mt-0.5 text-primary">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <a href={p.href}
                  className={`mt-8 block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                    p.popular
                      ? 'bg-primary text-white hover:bg-[#4e7d6d]'
                      : 'border border-border text-ink hover:bg-surface-2'
                  }`}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1">
              <span className="text-xl font-extrabold text-ink">Tlhiso</span>
              <p className="mt-2 text-sm text-ink-secondary">Run your business. Smarter.</p>
              <p className="mt-4 text-xs text-ink-secondary">
                <a href="mailto:hello@tlhiso.com" className="hover:text-primary">Hello@tlhiso.com</a>
              </p>
            </div>
            <div>
              <p className="label-caps mb-3 text-xs text-ink-secondary">Product</p>
              <ul className="space-y-2 text-sm text-ink-secondary">
                <li><a href="#features" className="hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                <li><Link to="/register" className="hover:text-primary">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <p className="label-caps mb-3 text-xs text-ink-secondary">Industries</p>
              <ul className="space-y-2 text-sm text-ink-secondary">
                {INDUSTRY_LIST.map((ind) => (
                  <li key={ind.key}><Link to="/register" className="hover:text-primary">{ind.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="label-caps mb-3 text-xs text-ink-secondary">Legal</p>
              <ul className="space-y-2 text-sm text-ink-secondary">
                <li><Link to="/legal/terms" className="hover:text-primary">Terms of Service</Link></li>
                <li><Link to="/legal/privacy" className="hover:text-primary">Privacy Policy</Link></li>
                <li>
                  <a href="https://github.com/adobeing" target="_blank" rel="noreferrer" className="hover:text-primary">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-border pt-6 text-center">
            <p className="text-xs text-ink-secondary">
              © {new Date().getFullYear()} Tlhiso. All rights reserved.
              &nbsp;·&nbsp;
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
