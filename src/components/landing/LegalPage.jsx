import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '1 July 2025'
const COMPANY = 'Tlhiso (Pty) Ltd'
const COMPANY_ADDRESS = 'Benoni, Gauteng, South Africa'
const EMAIL = 'hello@tlhiso.com'
const WEBSITE = 'https://tlhiso.com'

/* ── Shared layout helpers ──────────────────────────────────────────────────── */
function Section({ id, title, children }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="mb-3 border-b border-border pb-2 text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-secondary">{children}</div>
    </section>
  )
}

function Sub({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-sm font-semibold text-ink">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-ink-secondary">{children}</div>
    </div>
  )
}

function Li({ children }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1 flex-shrink-0 text-primary">•</span>
      <span>{children}</span>
    </li>
  )
}

function Callout({ type = 'blue', icon, title, children }) {
  const styles = {
    blue:   'bg-blue-50 border-blue-200 text-blue-900',
    green:  'bg-green-50 border-green-200 text-green-900',
    amber:  'bg-amber-50 border-amber-200 text-amber-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    red:    'bg-red-50 border-red-200 text-red-900',
  }
  return (
    <div className={`mb-4 flex gap-3 rounded-xl border px-4 py-3.5 ${styles[type]}`}>
      {icon && <span className="mt-0.5 flex-shrink-0 text-lg leading-none">{icon}</span>}
      <div className="text-sm leading-relaxed">
        {title && <strong className="mb-1 block">{title}</strong>}
        {children}
      </div>
    </div>
  )
}

function DataTable({ head, rows }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead className="bg-surface-2">
          <tr>
            {head.map(h => <th key={h} className="px-4 py-2.5 text-left font-semibold text-ink">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-semibold text-ink' : 'text-ink-secondary'}`}
                  dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Terms of Service ───────────────────────────────────────────────────────── */
function TermsContent() {
  return (
    <>
      <Callout type="blue" icon="ℹ️" title="Plain-English Summary">
        Tlhiso is a South African business management platform. You keep ownership of your data. You are responsible
        for getting consent from your customers before messaging them. We don't sell your data. You can cancel at
        any time. SA law applies.
      </Callout>

      {/* 1 */}
      <Section id="s1" title="1. Definitions">
        <DataTable
          head={['Term', 'Meaning']}
          rows={[
            ['"Tlhiso"', 'The platform, its website, dashboard, API, and related services operated by Tlhiso (Pty) Ltd, registered and based in Benoni, Gauteng, South Africa.'],
            ['"We / Us / Our"', 'Tlhiso (Pty) Ltd, its directors, employees and authorised agents.'],
            ['"You / User"', 'Any person or business that registers for, accesses, or uses the Tlhiso platform.'],
            ['"Platform"', 'The Tlhiso web dashboard, mobile interface, API, and any associated software.'],
            ['"Customers / Contacts"', 'The end-recipients (your customers, patients or clients) stored in your Tlhiso account.'],
            ['"Content"', 'Any text, images, data, campaign messages, surveys or other material you upload or send via the Platform.'],
            ['"POPIA"', 'The Protection of Personal Information Act 4 of 2013 (South Africa).'],
            ['"ECTA"', 'The Electronic Communications and Transactions Act 25 of 2002 (South Africa).'],
            ['"CPA"', 'The Consumer Protection Act 68 of 2008 (South Africa).'],
            ['"Subscription"', 'A paid plan (Starter, Professional, or Business) that gives you access to the Platform\'s features.'],
          ]}
        />
      </Section>

      {/* 2 */}
      <Section id="s2" title="2. Acceptance of Terms">
        <p>
          By creating an account, clicking "Get started", logging in, or otherwise accessing or using the Tlhiso
          Platform, you confirm that you have read, understood, and agree to be bound by these Terms of Service,
          our{' '}
          <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and all other
          policies referenced herein.
        </p>
        <p>
          If you are accepting these Terms on behalf of a company or other legal entity, you represent that you
          have the authority to bind that entity. If you do not agree to these Terms, you may not use the Platform.
        </p>
        <Callout type="amber" icon="⚠️" title="Your dashboard is activated by us">
          Registration alone does not grant access. Your account becomes active only once your invoice has been
          paid and we have published your dashboard. Access may be suspended if payment lapses.
        </Callout>
      </Section>

      {/* 3 */}
      <Section id="s3" title="3. Eligibility &amp; Registration">
        <p>To use Tlhiso you must:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Be at least 18 years of age or the age of majority in your jurisdiction.</Li>
          <Li>Be a registered business, sole trader, or professional entity operating lawfully in South Africa or another jurisdiction where the Platform is made available.</Li>
          <Li>Provide accurate, current and complete registration information and keep it up to date.</Li>
          <Li>Maintain the security of your login credentials. You are solely responsible for all activity that occurs under your account.</Li>
          <Li>Notify us immediately at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a> if you suspect any unauthorised access.</Li>
        </ul>
        <p className="mt-3">
          We reserve the right to refuse registration or suspend accounts at our discretion, including where we
          believe the information provided is false or where your use violates these Terms.
        </p>
      </Section>

      {/* 4 */}
      <Section id="s4" title="4. Subscription Plans &amp; Payment">
        <p>Tlhiso offers three subscription tiers. Features available on each plan are described on our Pricing page and may be updated from time to time.</p>
        <ul className="mt-2 space-y-1.5">
          <Li><strong>Starter — R699/mo</strong> — 1,000 campaign messages. Suitable for all industries.</Li>
          <Li><strong>Professional — R2,699/mo</strong> — 3,000 campaign messages. Ideal for medical practices.</Li>
          <Li><strong>Business — R4,999/mo</strong> — 10,000 campaign messages. Ideal for B2B companies and property managers.</Li>
        </ul>
        <Sub title="4.1 Billing">
          <p>All prices are quoted in South African Rand (ZAR) and are exclusive of VAT at 15%. Invoices are issued monthly. Payment is due within the period stated on your invoice.</p>
        </Sub>
        <Sub title="4.2 Activation">
          <p>Your dashboard is published and features unlocked only after we confirm receipt of your first payment. Continued access depends on timely monthly payment.</p>
        </Sub>
        <Sub title="4.3 Suspension">
          <p>If payment is not received by the due date, we may suspend your dashboard. You will still be able to log in and view your account, but outbound messaging and other paid features will be disabled until the outstanding balance is settled.</p>
        </Sub>
        <Sub title="4.4 No Refunds">
          <p>All fees paid are non-refundable except as required by the Consumer Protection Act or where we have failed to deliver the agreed service.</p>
        </Sub>
        <Sub title="4.5 Plan Changes">
          <p>Upgrades or downgrades take effect at the start of the next billing cycle unless otherwise agreed in writing.</p>
        </Sub>
      </Section>

      {/* 5 */}
      <Section id="s5" title="5. Permitted Use">
        <p>You may use the Platform solely for lawful business management and communication purposes, including:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Sending SMS, WhatsApp and email campaigns to customers who have given verifiable consent.</Li>
          <Li>Managing customer, patient, or tenant records within your own business account.</Li>
          <Li>Creating and distributing surveys and booking forms to your own contacts.</Li>
          <Li>Scheduling and managing appointments, inspections, or consultations.</Li>
          <Li>Generating invoices, statements, and reports for your own internal business use.</Li>
        </ul>
        <p className="mt-3">Each registered business on the Platform is a separate tenant. You must not access data belonging to other users or businesses.</p>
      </Section>

      {/* 6 */}
      <Section id="s6" title="6. Prohibited Conduct">
        <p>You agree not to use the Platform to:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Send unsolicited messages (spam) to persons who have not given explicit consent.</Li>
          <Li>Send messages that are harassing, defamatory, obscene, discriminatory or unlawful.</Li>
          <Li>Impersonate any person, business or brand, including Tlhiso.</Li>
          <Li>Violate any applicable law, including POPIA, ECTA, the National Credit Act, or consumer protection legislation.</Li>
          <Li>Harvest, scrape or otherwise collect contact data from third-party sources without those individuals' consent.</Li>
          <Li>Attempt to reverse-engineer, decompile or derive the source code of the Platform.</Li>
          <Li>Use automated tools (bots, crawlers, scrapers) to access the Platform without our written permission.</Li>
          <Li>Upload or distribute malicious code, viruses or any software that interferes with the Platform.</Li>
          <Li>Resell, sublicense or white-label the Platform without our prior written consent.</Li>
          <Li>Bypass any access controls, security measures or authentication systems.</Li>
        </ul>
        <p className="mt-3">Violation of these prohibitions may result in immediate suspension or termination of your account and, where appropriate, referral to law enforcement.</p>
      </Section>

      {/* 7 */}
      <Section id="s7" title="7. SMS, WhatsApp &amp; Email Rules">
        <Callout type="red" icon="📱" title="You are the sender — not us">
          Tlhiso is a platform that facilitates your communications. You remain solely responsible for the content
          you send and for complying with all applicable laws regarding electronic direct marketing.
        </Callout>
        <Sub title="7.1 Consent">
          <p>Before sending any marketing message you must have obtained the recipient's prior consent in accordance with POPIA section 69 and ECTA section 45. Consent must be freely given, specific, informed and unambiguous.</p>
        </Sub>
        <Sub title="7.2 Opt-Out">
          <p>Every marketing message must include a clear and easy method for the recipient to opt out. You must honour all opt-out requests immediately and record them as Do Not Contact (DNC) in the Platform.</p>
        </Sub>
        <Sub title="7.3 Identification">
          <p>You must clearly identify your business name in every message. Messages sent on behalf of another business must make that relationship clear.</p>
        </Sub>
        <Sub title="7.4 Message Limits">
          <p>Your subscription plan includes a monthly campaign message allocation. Messages beyond that allocation are not sent. Unused messages do not roll over.</p>
        </Sub>
      </Section>

      {/* 8 */}
      <Section id="s8" title="8. Data &amp; Privacy">
        <p>
          Your use of the Platform involves the collection and processing of personal information. Our full{' '}
          <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link> explains exactly
          what we collect, why, and how it is protected. These Terms incorporate the Privacy Policy by reference.
        </p>
        <p><strong className="text-ink">Your data.</strong> You own the customer and contact data you upload to the Platform. You grant us a limited licence to store, process and transmit that data solely for the purpose of providing the service.</p>
        <p><strong className="text-ink">Our obligations.</strong> We are a Responsible Party under POPIA and implement appropriate technical and organisational safeguards to protect personal information from unauthorised access, loss or disclosure.</p>
        <p><strong className="text-ink">Retention.</strong> We retain your account data for as long as your account is active and for 30 days after closure. You may request deletion of your data by contacting us.</p>
      </Section>

      {/* 9 */}
      <Section id="s9" title="9. Medical &amp; Sensitive Data">
        <Callout type="blue" icon="🏥" title="Medical industry users only">
          This section applies if your registered industry is medical (clinic, doctor, dentist, pharmacy, physio,
          optometry, veterinary, hospital or similar).
        </Callout>
        <p>The Platform provides features that allow medical practices to collect patient information including name, SA ID number, date of birth, gender, medical aid details, emergency contact information, allergies, chronic conditions and current medication.</p>
        <p><strong className="text-ink">Your responsibilities as a healthcare provider:</strong></p>
        <ul className="mt-2 space-y-1.5">
          <Li>Obtain valid POPIA-compliant consent from each patient before collecting their health information.</Li>
          <Li>Ensure your patients understand that their information will be stored on a cloud-based platform and transmitted electronically.</Li>
          <Li>Maintain professional confidentiality obligations under the Health Professions Act 56 of 1974, the National Health Act 61 of 2003, and applicable professional codes of conduct.</Li>
          <Li>Not use the Platform as a substitute for a certified Electronic Health Record (EHR) system where one is legally required.</Li>
          <Li>Notify patients of their right to access and correct their records, and to object to processing.</Li>
        </ul>
        <p className="mt-3"><strong className="text-ink">Our role.</strong> Tlhiso stores patient data as a processor on your behalf. We do not use patient health information for any purpose other than providing the Platform to you. Health data is stored in Google Firebase (Firestore) with encryption in transit and at rest.</p>
        <p>Health information is classified as a "special category" under POPIA. You acknowledge that you are the Responsible Party for all patient data and that you have a lawful basis for collecting and processing it.</p>
      </Section>

      {/* 10 */}
      <Section id="s10" title="10. Intellectual Property">
        <p><strong className="text-ink">Platform IP.</strong> All software, designs, trademarks, logos, algorithms, source code and documentation that form part of the Platform are the exclusive property of {COMPANY} and its licensors. Nothing in these Terms transfers any intellectual property rights to you.</p>
        <p><strong className="text-ink">Your content.</strong> You retain full ownership of all content you upload or create through the Platform, including campaign messages, customer lists and survey questions. You grant us a non-exclusive, royalty-free licence to use that content solely to provide the service.</p>
        <p><strong className="text-ink">Feedback.</strong> If you provide us with ideas, suggestions or feedback about the Platform, we may use them without any obligation or compensation to you.</p>
      </Section>

      {/* 11 */}
      <Section id="s11" title="11. Third-Party Services">
        <p>The Platform integrates with and relies on third-party services including:</p>
        <ul className="mt-2 space-y-1.5">
          <Li><strong>Google Firebase</strong> — authentication, database, file storage and hosting — subject to Google's Terms of Service.</Li>
          <Li><strong>BulkSMS</strong> — SMS delivery to South African mobile numbers, subject to their Acceptable Use Policy.</Li>
          <Li><strong>Twilio</strong> — WhatsApp messaging, subject to their terms and Meta's Business Policy.</Li>
          <Li><strong>SendGrid</strong> — transactional and campaign email delivery, subject to their anti-spam policies.</Li>
          <Li><strong>Google Cloud Speech-to-Text</strong> — audio transcription for Medical plan users.</Li>
        </ul>
        <p className="mt-3">We are not liable for any outage, error, policy change or service interruption caused by these third-party providers.</p>
      </Section>

      {/* 12 */}
      <Section id="s12" title="12. Disclaimers">
        <p className="font-semibold text-ink">THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW.</p>
        <p>We do not warrant that:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>The Platform will be uninterrupted, error-free, or completely secure.</Li>
          <Li>Any particular message will be delivered to its recipient — delivery depends on mobile network operators, device status and third-party systems outside our control.</Li>
          <Li>The Platform will meet your specific business requirements.</Li>
          <Li>Results from campaigns (response rates, sales conversions) will achieve any particular outcome.</Li>
        </ul>
        <p className="mt-3">Nothing in these Terms limits any rights you may have under the Consumer Protection Act 68 of 2008 that cannot be contractually excluded.</p>
      </Section>

      {/* 13 */}
      <Section id="s13" title="13. Limitation of Liability">
        <p>To the maximum extent permitted by South African law, Tlhiso and its directors, employees and agents shall not be liable for any:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Indirect, incidental, special or consequential loss or damage.</Li>
          <Li>Loss of revenue, profits, business, data or goodwill.</Li>
          <Li>Damage arising from undelivered, misdirected or delayed messages.</Li>
          <Li>Regulatory fines or penalties you incur due to your own use of the Platform.</Li>
          <Li>Loss caused by your failure to comply with POPIA or other applicable law.</Li>
        </ul>
        <p className="mt-3">Our total aggregate liability for any claim arising from or related to your use of the Platform shall not exceed the total fees you paid us in the three calendar months immediately preceding the event giving rise to the claim.</p>
      </Section>

      {/* 14 */}
      <Section id="s14" title="14. Indemnification">
        <p>You agree to indemnify, defend and hold harmless Tlhiso, its directors, officers, employees and agents from and against any claims, liabilities, damages, losses, penalties, fines and expenses (including reasonable legal fees) arising out of or in connection with:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Your use of the Platform in violation of these Terms or any applicable law.</Li>
          <Li>The content of any campaign messages you send, including claims of spam, defamation or intellectual property infringement.</Li>
          <Li>Your failure to obtain valid consent from recipients before messaging them.</Li>
          <Li>Any breach of your obligations under POPIA, particularly in relation to patient health data.</Li>
          <Li>Any dispute between you and a customer, patient or other third party.</Li>
        </ul>
      </Section>

      {/* 15 */}
      <Section id="s15" title="15. Termination">
        <Sub title="15.1 By You">
          <p>You may close your account at any time by contacting us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>. No refund is due for any unexpired portion of a paid billing period.</p>
        </Sub>
        <Sub title="15.2 By Us">
          <p>We may suspend or terminate your account immediately and without notice if you violate these Terms, fail to pay outstanding invoices after reasonable notice, use the Platform in a way that exposes us or third parties to legal risk, or provide false or misleading registration information.</p>
        </Sub>
        <Sub title="15.3 Effect of Termination">
          <p>Upon termination, your right to access the Platform ceases immediately. We will retain your data for a period of 30 days, during which you may request an export. After that period, your data may be permanently deleted. Provisions that by their nature should survive termination (including limitations of liability, indemnification, and dispute resolution) shall continue to apply.</p>
        </Sub>
      </Section>

      {/* 16 */}
      <Section id="s16" title="16. Dispute Resolution">
        <Sub title="16.1 Informal Resolution First">
          <p>If you have a complaint or dispute, please contact us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a> and we will make a genuine effort to resolve it informally within 14 business days.</p>
        </Sub>
        <Sub title="16.2 Mediation">
          <p>If the matter is not resolved informally, either party may refer the dispute to a South African accredited mediator agreed upon by both parties. The costs of mediation shall be shared equally unless the mediator determines otherwise.</p>
        </Sub>
        <Sub title="16.3 Arbitration">
          <p>If mediation fails, the dispute shall be referred to and finally resolved by arbitration under the Arbitration Act 42 of 1965. The seat of arbitration shall be Johannesburg, Gauteng.</p>
        </Sub>
        <Sub title="16.4 Consumer Rights">
          <p>Nothing in this clause limits your right to approach the National Consumer Commission or any other regulatory body as provided for under the Consumer Protection Act.</p>
        </Sub>
      </Section>

      {/* 17 */}
      <Section id="s17" title="17. Governing Law">
        <p>These Terms are governed by and construed in accordance with the laws of the Republic of South Africa. Both parties submit to the non-exclusive jurisdiction of the courts of South Africa, and in particular the High Court of South Africa (Gauteng Division, Johannesburg).</p>
        <p>Where you access the Platform from outside South Africa, you are responsible for compliance with local laws that apply to your use. South African law will still govern these Terms.</p>
      </Section>

      {/* 18 */}
      <Section id="s18" title="18. Changes to Terms">
        <p>We may update these Terms from time to time to reflect changes in our services, technology, or applicable law. When we make material changes, we will:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Update the "Last updated" date at the top of this page.</Li>
          <Li>Send an email notification to the address on your account at least 14 days before the new terms take effect.</Li>
          <Li>Display a banner on the dashboard informing you of the change.</Li>
        </ul>
        <p className="mt-3">Your continued use of the Platform after the effective date constitutes acceptance of the updated Terms. If you do not agree, you must stop using the Platform and contact us to close your account.</p>
      </Section>

      {/* 19 */}
      <Section id="s19" title="19. Contact Us">
        <p>If you have questions about these Terms, our practices, or your rights, please reach out:</p>
        <div className="mt-2 rounded-xl bg-surface-2 px-5 py-4 text-sm">
          <p className="font-semibold text-ink">{COMPANY}</p>
          <p>Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
          <p>Website: <a href={WEBSITE} className="text-primary hover:underline">{WEBSITE}</a></p>
          <p>{COMPANY_ADDRESS}</p>
          <p className="mt-1 text-ink-secondary">Business Hours: Monday – Friday, 08:00 – 17:00 SAST</p>
        </div>
      </Section>
    </>
  )
}

/* ── Privacy Policy ─────────────────────────────────────────────────────────── */
function PrivacyContent() {
  return (
    <>
      <Callout type="green" icon="✅" title="Our commitment in plain English">
        We collect only what we need. We never sell your data. Your customers' data belongs to you. You can
        request deletion at any time. We comply fully with POPIA.
      </Callout>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <span className="rounded-md bg-blue-600 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-white">POPIA</span>
        <p className="text-xs leading-relaxed text-blue-900">
          This policy is drafted in compliance with the <strong>Protection of Personal Information Act 4 of 2013</strong> (South Africa) and the <strong>Electronic Communications and Transactions Act 25 of 2002</strong>.
        </p>
      </div>

      {/* 1 */}
      <Section id="s1" title="1. Who We Are">
        <p>Tlhiso is a South African business management platform operated by <strong className="text-ink">{COMPANY}</strong>, based in {COMPANY_ADDRESS}.</p>
        <p>For the purposes of POPIA, Tlhiso is the <strong className="text-ink">Responsible Party</strong> in respect of the personal information of registered platform users (business owners and their staff). For the personal information of your customers and patients stored in your account, you are the Responsible Party and we act as your <strong className="text-ink">Operator</strong>.</p>
        <p><strong className="text-ink">Our Information Officer</strong> can be contacted at:</p>
        <div className="mt-2 rounded-xl bg-surface-2 px-5 py-4 text-sm">
          <p className="font-semibold text-ink">{COMPANY}</p>
          <p>Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
          <p>Website: <a href={WEBSITE} className="text-primary hover:underline">{WEBSITE}</a></p>
          <p>{COMPANY_ADDRESS}</p>
        </div>
      </Section>

      {/* 2 */}
      <Section id="s2" title="2. Information We Collect">
        <p>We collect different categories of personal information depending on how you interact with us:</p>
        <div className="mt-3">
          <DataTable
            head={['Category', 'Examples', 'Source']}
            rows={[
              ['Account Information', 'Name, email address, password (hashed), phone number', 'You provide it at registration'],
              ['Business Profile', 'Business name, industry, city, province, phone number, logo', 'You provide it in your profile settings'],
              ['Payment Information', 'Invoice records, payment confirmation, plan tier', 'Generated by us; payment processed offline'],
              ['Usage Data', 'Pages visited, features used, message volume, log timestamps', 'Automatically collected while you use the Platform'],
              ['Customer / Contact Data', 'Names, phone numbers, email addresses of your customers', 'You upload or import it; or customers submit it via public forms'],
              ['Patient Data (medical only)', 'SA ID number, date of birth, gender, medical aid details, emergency contacts, allergies, chronic conditions, current medication', 'You enter it, or patients submit it via the intake form'],
              ['Communications', 'Emails and messages you send to our support team', 'You provide it by contacting us'],
              ['Technical Data', 'IP address, browser type, device type, session tokens', 'Automatically collected by Firebase'],
            ]}
          />
        </div>
        <p className="mt-3">We do not collect sensitive financial information such as banking account numbers or credit card numbers directly. Payments are coordinated offline.</p>
      </Section>

      {/* 3 */}
      <Section id="s3" title="3. How We Use Your Information">
        <p>We use the personal information we collect for the following purposes:</p>
        <ul className="mt-2 space-y-1.5">
          <Li><strong>Service delivery</strong> — creating and maintaining your account, activating features, and providing the Platform as contracted.</Li>
          <Li><strong>Billing and invoicing</strong> — generating and sending invoices, tracking subscription status, and managing account activation.</Li>
          <Li><strong>Communication</strong> — sending you service notifications, updates, and responses to support queries.</Li>
          <Li><strong>Security and fraud prevention</strong> — monitoring for suspicious activity, enforcing access controls, and protecting against abuse.</Li>
          <Li><strong>Product improvement</strong> — analysing usage patterns (in aggregate, not individual profiling) to improve features and performance.</Li>
          <Li><strong>Legal compliance</strong> — maintaining records as required by South African law, responding to lawful legal requests.</Li>
          <Li><strong>Platform administration</strong> — managing your business accounts, plan changes, and user permissions.</Li>
        </ul>
        <p className="mt-3">We do <strong className="text-ink">not</strong> use your data or your customers' data for advertising, profiling for third-party purposes, or sale to data brokers.</p>
      </Section>

      {/* 4 */}
      <Section id="s4" title="4. Lawful Basis for Processing">
        <p>Under POPIA, every processing activity must have a lawful basis:</p>
        <div className="mt-3">
          <DataTable
            head={['Processing Activity', 'Lawful Basis (POPIA)']}
            rows={[
              ['Providing the Platform to registered users', 'Contractual necessity (§11(1)(b))'],
              ['Sending invoices and managing billing', 'Contractual necessity; Legitimate interest'],
              ['Account security and fraud prevention', 'Legitimate interest (§11(1)(f))'],
              ['Sending service notifications', 'Contractual necessity; Legitimate interest'],
              ['Storing your customer/contact lists', 'Contractual necessity (acting as your Operator)'],
              ['Storing patient health data', 'Explicit consent from patient (§26); Your lawful obligation as healthcare provider'],
              ['Sending you product updates', 'Legitimate interest; Opt-out available'],
              ['Analytics and platform improvement', 'Legitimate interest (aggregated, not individual)'],
            ]}
          />
        </div>
      </Section>

      {/* 5 */}
      <Section id="s5" title="5. Customer &amp; Contact Data">
        <Callout type="blue" icon="👤" title="You are the Responsible Party for your customers' data">
          Tlhiso processes your customers' names, phone numbers and email addresses solely on your instructions.
          We do not use their data for any independent purpose.
        </Callout>
        <p>When you import or create a customer record on the Platform, you confirm that:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>You have obtained valid consent from that individual to receive marketing messages from your business.</Li>
          <Li>You are entitled under POPIA to process and store their personal information.</Li>
          <Li>You will honour all opt-out requests and mark them as Do Not Contact (DNC) in the Platform.</Li>
          <Li>You will not use the Platform to contact individuals outside South Africa without ensuring compliance with the laws of their jurisdiction.</Li>
        </ul>
        <p className="mt-3">Tlhiso stores customer data in Google Firebase (Firestore) with tenant isolation — your customers' data is logically separated from other businesses' data by owner ID at the database rules level.</p>
      </Section>

      {/* 6 */}
      <Section id="s6" title="6. Medical &amp; Health Data">
        <Callout type="purple" icon="🏥" title="Special category data under POPIA section 26">
          Health information receives the highest level of protection under POPIA. This section applies only to
          medical, clinic, dental, pharmacy, physiotherapy, optometry, veterinary and hospital users.
        </Callout>
        <p>Medical practice users may use the Platform to collect the following categories of patient information: full name, SA ID number, date of birth, gender, residential address, medical aid name and number, emergency contact details, known allergies, chronic conditions and current medication.</p>
        <Sub title="6.1 Consent">
          <p>The platform requires explicit POPIA-aligned consent before any patient information is saved. Patients without consent cannot submit the form.</p>
        </Sub>
        <Sub title="6.2 Purpose Limitation">
          <p>Patient health data is used only to populate the patient record in your dashboard. It is not used for marketing profiling, shared with third parties, or accessed by Tlhiso staff except for platform maintenance purposes under strict confidentiality.</p>
        </Sub>
        <Sub title="6.3 Data Minimisation">
          <p>Medical practices should only collect patient information that is necessary for the healthcare services they provide. You are not required to collect all available fields.</p>
        </Sub>
        <Sub title="6.4 Storage">
          <p>All patient data is stored in Google Firebase (Firestore). It is encrypted in transit (TLS 1.2+) and at rest using AES-256.</p>
        </Sub>
      </Section>

      {/* 7 */}
      <Section id="s7" title="7. How We Share Your Information">
        <p>We <strong className="text-ink">do not sell</strong> your personal information or your customers' personal information to any third party, ever.</p>
        <p>We share personal information only in the following limited circumstances:</p>
        <ul className="mt-2 space-y-1.5">
          <Li><strong>Service providers (sub-processors):</strong> We share data with the third-party providers listed in Section 8 below, solely to the extent necessary to provide the Platform.</Li>
          <Li><strong>Legal requirements:</strong> We may disclose information where required by law, court order, or to comply with a lawful request from a government or regulatory authority (including the Information Regulator).</Li>
          <Li><strong>Business transfers:</strong> In the event of a merger, acquisition or sale of assets, personal information may be transferred as part of that transaction. We will notify you before any such transfer.</Li>
          <Li><strong>Protection of rights:</strong> We may disclose information where necessary to prevent fraud, protect the safety of any person, or enforce our Terms of Service.</Li>
        </ul>
      </Section>

      {/* 8 */}
      <Section id="s8" title="8. Third-Party Sub-Processors">
        <p>We use the following sub-processors to deliver the Platform. Each is engaged under a data processing agreement or equivalent contractual safeguard:</p>
        <div className="mt-3">
          <DataTable
            head={['Provider', 'Purpose', 'Data Processed', 'Location']}
            rows={[
              ['Google Firebase', 'Database, authentication, file storage', 'All platform data including customer and patient records', 'EU (Belgium) / US'],
              ['BulkSMS', 'SMS message delivery', 'Recipient phone numbers and message content', 'South Africa'],
              ['Twilio', 'WhatsApp messaging', 'Recipient phone numbers and message content', 'USA'],
              ['SendGrid', 'Transactional email delivery', 'Recipient email addresses and email content', 'USA'],
              ['Google Cloud Speech-to-Text', 'Audio transcription (Medical)', 'Audio recordings of consultations', 'USA (Google LLC)'],
            ]}
          />
        </div>
        <p className="mt-3">We review our sub-processors regularly. An up-to-date list is available on request at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.</p>
      </Section>

      {/* 9 */}
      <Section id="s9" title="9. International Transfers">
        <p>Some of our sub-processors are located outside South Africa (primarily the United States and the European Union). When we transfer personal information to these processors, we do so in compliance with POPIA section 72, which requires us to ensure that the recipient provides an adequate level of protection.</p>
        <p>Our safeguards include:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Data processing agreements with all sub-processors that include POPIA-aligned obligations.</Li>
          <Li>Use of Google Firebase's EU region (Belgium) for primary data storage to benefit from GDPR-equivalent protections.</Li>
          <Li>Our messaging and email delivery partners' compliance with the EU-US Data Privacy Framework and their own privacy policies.</Li>
        </ul>
        <p className="mt-3">You may request details of these safeguards by contacting our Information Officer.</p>
      </Section>

      {/* 10 */}
      <Section id="s10" title="10. Security">
        <p>We implement appropriate technical and organisational security measures to protect personal information from loss, misuse, unauthorised access, disclosure, alteration and destruction. These measures include:</p>
        <ul className="mt-2 space-y-1.5">
          <Li><strong>Encryption in transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2 or higher.</Li>
          <Li><strong>Encryption at rest:</strong> All Firestore data is encrypted at rest using AES-256.</Li>
          <Li><strong>Access controls:</strong> Firestore Security Rules enforce strict per-user, per-business data isolation. Users can only access data belonging to their own businesses.</Li>
          <Li><strong>Authentication:</strong> Firebase Authentication handles login with industry-standard hashing. Admin functions require server-side validation against the registered Super Admin UID.</Li>
          <Li><strong>No client-side secrets:</strong> API keys and credentials are stored server-side in Google Secret Manager and are never exposed to browsers.</Li>
        </ul>
        <Callout type="amber" icon="⚠️" title="If you suspect a security incident">
          Please notify us immediately at <a href={`mailto:${EMAIL}`} className="underline">{EMAIL}</a>. We will
          investigate and, where required by law, notify affected individuals and the Information Regulator within
          72 hours of becoming aware of a breach.
        </Callout>
      </Section>

      {/* 11 */}
      <Section id="s11" title="11. Data Retention">
        <DataTable
          head={['Data Type', 'Retention Period']}
          rows={[
            ['Account &amp; business profile data', 'Duration of your subscription + 30 days after account closure'],
            ['Customer and contact records', 'Duration of your subscription + 30 days after account closure'],
            ['Patient health data', 'Duration of subscription + 30 days; or longer if required by healthcare law'],
            ['Invoice and billing records', '7 years (required by the Companies Act / SARS)'],
            ['Server logs and audit logs', '90 days (rolling)'],
            ['Campaign and message history', 'Duration of subscription + 30 days'],
            ['Support communications', '3 years from last interaction'],
          ]}
        />
        <p className="mt-3">You may request early deletion of your data at any time. We will honour deletion requests within 30 days except where retention is required by law.</p>
        <p><strong className="text-ink">Data export.</strong> Before deleting your account, you may request a data export in CSV or JSON format by contacting us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.</p>
      </Section>

      {/* 12 */}
      <Section id="s12" title="12. Cookies &amp; Tracking">
        <p>Our website and dashboard use a small number of technical cookies and local storage entries:</p>
        <ul className="mt-2 space-y-1.5">
          <Li><strong>Firebase Authentication cookies:</strong> Used to keep you logged in during a session. These are essential and cannot be disabled without breaking authentication.</Li>
          <Li><strong>Local Storage (dashboard):</strong> We store your dashboard state in your browser's local storage to persist settings between sessions. This data never leaves your device.</Li>
          <Li><strong>No advertising cookies:</strong> We do not use Google Analytics, Meta Pixel, or any other third-party advertising or tracking cookies on the Platform.</Li>
        </ul>
      </Section>

      {/* 13 */}
      <Section id="s13" title="13. Your Rights Under POPIA">
        <p>As a data subject under POPIA, you have the following rights. To exercise any of these rights, contact us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>. We will respond within <strong className="text-ink">30 days</strong>.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { icon: '👁', title: 'Right to Access', text: 'Request a copy of the personal information we hold about you in a readable format.' },
            { icon: '✏️', title: 'Right to Correction', text: 'Request that we correct inaccurate or incomplete personal information.' },
            { icon: '🗑️', title: 'Right to Deletion', text: 'Request deletion of your personal information, subject to any legal retention obligations.' },
            { icon: '🚫', title: 'Right to Object', text: 'Object to the processing of your personal information for specific purposes, such as direct marketing.' },
            { icon: '📦', title: 'Right to Portability', text: 'Request your data in a structured, machine-readable format (CSV or JSON).' },
            { icon: '⛔', title: 'Right to Restriction', text: 'Request that we restrict processing of your data in certain circumstances.' },
          ].map(r => (
            <div key={r.title} className="rounded-xl border border-border bg-white p-4">
              <div className="mb-2 text-xl">{r.icon}</div>
              <p className="mb-1 text-sm font-semibold text-ink">{r.title}</p>
              <p className="text-xs leading-relaxed text-ink-secondary">{r.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4"><strong className="text-ink">Complaints.</strong> If you believe we have not complied with POPIA, you have the right to lodge a complaint with the <strong className="text-ink">Information Regulator of South Africa</strong>:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Website: <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noreferrer" className="text-primary hover:underline">www.justice.gov.za/inforeg</a></Li>
          <Li>Email: <a href="mailto:inforeg@justice.gov.za" className="text-primary hover:underline">inforeg@justice.gov.za</a></Li>
        </ul>
      </Section>

      {/* 14 */}
      <Section id="s14" title="14. Children">
        <p>The Tlhiso Platform is designed for business use and is not directed at children under the age of 18. We do not knowingly collect personal information from children.</p>
        <p><strong className="text-ink">Exception for medical practices.</strong> Medical and healthcare users may legitimately collect patient information for patients under 18. In these cases, POPIA requires that consent be obtained from a parent or legal guardian. Healthcare providers are responsible for ensuring they have a valid lawful basis and appropriate consent for treating and recording information about minor patients.</p>
        <p>If we become aware that we have inadvertently collected personal information from a child without parental consent in a non-medical context, we will delete it promptly.</p>
      </Section>

      {/* 15 */}
      <Section id="s15" title="15. Marketing Communications">
        <p>We may send you email communications about new features, tips for using Tlhiso, or relevant industry information. These are sent to your registered account email address.</p>
        <p>You may opt out of marketing emails at any time by:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Clicking the "Unsubscribe" link in any marketing email we send you.</Li>
          <Li>Emailing us at <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a> with the subject "Marketing opt-out".</Li>
        </ul>
        <p className="mt-3">Note that opting out of marketing emails does not affect transactional emails such as invoices, payment confirmations, security alerts, and service notifications.</p>
      </Section>

      {/* 16 */}
      <Section id="s16" title="16. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. When we make material changes, we will:</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Update the "Last updated" date at the top of this page.</Li>
          <Li>Send an email notice to all registered account holders at least 14 days before the change takes effect.</Li>
          <Li>Show a notification banner on the dashboard.</Li>
        </ul>
        <p className="mt-3">Your continued use of the Platform after any changes take effect constitutes your acceptance of the updated Policy.</p>
      </Section>

      {/* 17 */}
      <Section id="s17" title="17. Contact &amp; Complaints">
        <p>For any privacy-related questions, to exercise your POPIA rights, or to raise a concern, contact our Information Officer:</p>
        <div className="mt-2 rounded-xl bg-surface-2 px-5 py-4 text-sm">
          <p className="font-semibold text-ink">Information Officer — {COMPANY}</p>
          <p>Email: <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a></p>
          <p>Website: <a href={WEBSITE} className="text-primary hover:underline">{WEBSITE}</a></p>
          <p>{COMPANY_ADDRESS}</p>
          <p className="mt-1 text-ink-secondary">Business Hours: Monday – Friday, 08:00 – 17:00 SAST</p>
          <p className="mt-1 text-ink-secondary">Response Time: Within 30 days as required by POPIA.</p>
        </div>
        <p className="mt-3">If you are not satisfied with our response, you are entitled to escalate your complaint to the <strong className="text-ink">Information Regulator of South Africa</strong> at <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noreferrer" className="text-primary hover:underline">www.justice.gov.za/inforeg</a> or <a href="mailto:inforeg@justice.gov.za" className="text-primary hover:underline">inforeg@justice.gov.za</a>.</p>
      </Section>
    </>
  )
}

/* ── Table of contents ──────────────────────────────────────────────────────── */
const TOC_TERMS = [
  { id: 's1',  label: '1. Definitions' },
  { id: 's2',  label: '2. Acceptance of Terms' },
  { id: 's3',  label: '3. Eligibility & Registration' },
  { id: 's4',  label: '4. Subscription Plans & Payment' },
  { id: 's5',  label: '5. Permitted Use' },
  { id: 's6',  label: '6. Prohibited Conduct' },
  { id: 's7',  label: '7. SMS, WhatsApp & Email Rules' },
  { id: 's8',  label: '8. Data & Privacy' },
  { id: 's9',  label: '9. Medical & Sensitive Data' },
  { id: 's10', label: '10. Intellectual Property' },
  { id: 's11', label: '11. Third-Party Services' },
  { id: 's12', label: '12. Disclaimers' },
  { id: 's13', label: '13. Limitation of Liability' },
  { id: 's14', label: '14. Indemnification' },
  { id: 's15', label: '15. Termination' },
  { id: 's16', label: '16. Dispute Resolution' },
  { id: 's17', label: '17. Governing Law' },
  { id: 's18', label: '18. Changes to Terms' },
  { id: 's19', label: '19. Contact Us' },
]

const TOC_PRIVACY = [
  { id: 's1',  label: '1. Who We Are' },
  { id: 's2',  label: '2. Information We Collect' },
  { id: 's3',  label: '3. How We Use Your Information' },
  { id: 's4',  label: '4. Lawful Basis for Processing' },
  { id: 's5',  label: '5. Customer & Contact Data' },
  { id: 's6',  label: '6. Medical & Health Data' },
  { id: 's7',  label: '7. How We Share Your Information' },
  { id: 's8',  label: '8. Third-Party Sub-Processors' },
  { id: 's9',  label: '9. International Transfers' },
  { id: 's10', label: '10. Security' },
  { id: 's11', label: '11. Data Retention' },
  { id: 's12', label: '12. Cookies & Tracking' },
  { id: 's13', label: '13. Your Rights Under POPIA' },
  { id: 's14', label: '14. Children' },
  { id: 's15', label: '15. Marketing Communications' },
  { id: 's16', label: '16. Changes to This Policy' },
  { id: 's17', label: '17. Contact & Complaints' },
]

/* ── Page shell ─────────────────────────────────────────────────────────────── */
export default function LegalPage({ title }) {
  const isTerms = title === 'Terms of Service'
  const toc = isTerms ? TOC_TERMS : TOC_PRIVACY

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-extrabold tracking-tight text-ink">Tlhiso</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/legal/terms"
              className={`transition hover:text-primary ${isTerms ? 'font-semibold text-primary' : 'text-ink-secondary'}`}>
              Terms
            </Link>
            <Link to="/legal/privacy"
              className={`transition hover:text-primary ${!isTerms ? 'font-semibold text-primary' : 'text-ink-secondary'}`}>
              Privacy
            </Link>
            <Link to="/"
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#4e7d6d]">
              ← Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-border/60 bg-surface-2 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Legal</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-ink-secondary">
            Effective date: <strong>{EFFECTIVE_DATE}</strong> · Applies to all users of {WEBSITE}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-6 py-12 lg:flex lg:gap-12">

        {/* Sidebar TOC — desktop only */}
        <aside className="hidden w-56 flex-shrink-0 lg:block">
          <div className="sticky top-20">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-secondary">Contents</p>
            <nav className="space-y-0.5">
              {toc.map(item => (
                <a key={item.id} href={`#${item.id}`}
                  className="block rounded-lg px-3 py-1.5 text-xs text-ink-secondary transition hover:bg-surface-2 hover:text-ink">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 border-t border-border pt-4 text-xs">
              <Link
                to={isTerms ? '/legal/privacy' : '/legal/terms'}
                className="text-primary transition hover:underline">
                {isTerms ? 'View Privacy Policy →' : 'View Terms of Service →'}
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 max-w-3xl flex-1">
          {isTerms ? <TermsContent /> : <PrivacyContent />}

          <div className="mt-12 rounded-xl border border-border bg-surface-2 px-6 py-5 text-xs text-ink-secondary">
            <p>
              <strong className="text-ink">Questions?</strong>{' '}
              Email <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>.
              {' '}Last updated: <strong>{EFFECTIVE_DATE}</strong>.
              {' '}Governed by the laws of the Republic of South Africa.
            </p>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-ink-secondary/70 md:flex-row">
          <p>© {new Date().getFullYear()} {COMPANY}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/legal/terms" className="transition hover:text-primary">Terms of Service</Link>
            <Link to="/legal/privacy" className="transition hover:text-primary">Privacy Policy</Link>
            <Link to="/" className="transition hover:text-primary">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
