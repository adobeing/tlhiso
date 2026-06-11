// Single source of truth for the four industry verticals. Drives registration,
// routing, and dashboard selection so adding/renaming an industry is one edit.
export const INDUSTRIES = {
  b2b: {
    key: 'b2b',
    label: 'Business-to-Business',
    icon: '🏢',
    description: 'Manage client accounts, invoices, quotations and projects.',
    basePath: '/b2b/dashboard',
    professions: [
      'Consultant', 'Accountant', 'Attorney / Legal', 'IT Services',
      'Marketing Agency', 'Logistics', 'Wholesaler', 'Recruiter', 'Other',
    ],
  },
  medical: {
    key: 'medical',
    label: 'Medical & Health',
    icon: '🏥',
    description: 'Patient records, consultations, referrals and reminders.',
    basePath: '/medical/dashboard',
    professions: [
      'General Practitioner', 'Specialist', 'Dentist', 'Physiotherapist',
      'Psychologist / Counsellor', 'Nurse Practitioner', 'Optometrist',
      'Chiropractor', 'Dietitian', 'Pharmacist', 'Other',
    ],
  },
  property: {
    key: 'property',
    label: 'Property Management',
    icon: '🏘️',
    description: 'Properties, tenants, leases, maintenance and statements.',
    basePath: '/property/dashboard',
    professions: [
      'Residential Landlord', 'Commercial Property Manager', 'Estate Agent',
      'Body Corporate Manager', 'Short-Term Rental Host', 'Other',
    ],
  },
  retail: {
    key: 'retail',
    label: 'Consumer Business',
    icon: '🛍️',
    description: 'Customers, bookings, weekly deals and campaigns.',
    basePath: '/retail/dashboard',
    professions: [
      'Salon / Beauty', 'Fitness Trainer / Gym', 'Restaurant / Food',
      'Retail Store', 'Freelancer / Creative', 'Tutor / Coach',
      'Event Planner', 'Other',
    ],
  },
}

export const INDUSTRY_LIST = Object.values(INDUSTRIES)

// messages = campaign-only quota (SMS + email). Booking confirmations,
// appointment reminders, and other operational messages are NOT counted.
export const PLANS = {
  starter:    { key: 'starter',    name: 'Starter',       price: 699,  messages: 1000,  campaignOnly: true },
  business:   { key: 'business',   name: 'Professional',  price: 2699, messages: 3000,  campaignOnly: true, popular: true, idealFor: 'Medical practices & doctors' },
  enterprise: { key: 'enterprise', name: 'Business',      price: 4999, messages: 10000, campaignOnly: true, idealFor: 'B2B companies & property managers' },
}
export const PLAN_LIST = Object.values(PLANS)

export const SUPER_ADMIN_EMAIL = 'admin@adobeing.com'

// Resolve the dashboard a user should land on, given their industry field.
export function dashboardPathFor(industry) {
  return INDUSTRIES[industry]?.basePath ?? '/login'
}
