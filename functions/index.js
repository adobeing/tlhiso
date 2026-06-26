const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const crypto = require('crypto')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const admin = require('firebase-admin')

const SUPER_ADMIN_EMAIL = 'admin@adobeing.com'

function requireAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'You must be signed in to call this function.')
}

function requireSuperAdmin(req) {
  requireAuth(req)
  const email = req.auth.token?.email
  const isAdmin = email === SUPER_ADMIN_EMAIL || req.auth.token?.isAdmin === true
  if (!isAdmin) throw new HttpsError('permission-denied', 'Super admin access required.')
}

const sgMail = require('@sendgrid/mail')
const axios = require('axios')
const twilio = require('twilio')
const { SpeechClient } = require('@google-cloud/speech')
const speechClient = new SpeechClient()

admin.initializeApp()
const db = admin.firestore()
const storage = admin.storage()

// ── Config (set via: firebase functions:secrets:set KEY) ─────────────────────
const getConfig = () => ({
  sendgridKey: process.env.SENDGRID_API_KEY,
  sendgridFrom: process.env.SENDGRID_FROM_EMAIL || 'hello@notifications.tlhiso.com',
  sendgridFromName: process.env.SENDGRID_FROM_NAME || 'Tlhiso',
  sendgridReplyTo: 'hello@tlhiso.com',
  bulksmsTokenId: process.env.BULKSMS_TOKEN_ID,
  bulksmsTokenSecret: process.env.BULKSMS_TOKEN_SECRET,
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioNumber: process.env.TWILIO_NUMBER,
  twilioWhatsapp: process.env.TWILIO_WHATSAPP_NUMBER,
})

// ── 1. sendEmail ──────────────────────────────────────────────────────────────
// Accepts an optional `attachments` array (e.g. a branded PDF report) and
// forwards it to SendGrid. Attachment shape:
//   { content: <base64, no data: prefix>, filename, type, disposition }
exports.sendEmail = onCall({ secrets: ['SENDGRID_API_KEY'] }, async (req) => {
  requireAuth(req)
  const { to, subject, htmlBody, templateId, attachments } = req.data
  if (!to || !htmlBody) return { success: false, error: 'Missing to or htmlBody' }
  const cfg = getConfig()
  sgMail.setApiKey(cfg.sendgridKey)
  try {
    const plainText = htmlBody
      .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/\s{2,}/g, '\n')
      .trim()
    const msg = {
      to,
      from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
      replyTo: cfg.sendgridReplyTo,
      subject: subject || '(no subject)',
      html: htmlBody,
      text: plainText,
      headers: {
        'List-Unsubscribe': `<mailto:${cfg.sendgridReplyTo}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
    if (templateId) msg.templateId = templateId
    if (Array.isArray(attachments) && attachments.length) {
      msg.attachments = attachments.map(a => ({
        content: a.content,                       // base64 string, no data: prefix
        filename: a.filename || 'attachment.pdf',
        type: a.type || 'application/pdf',
        disposition: a.disposition || 'attachment',
      }))
    }
    await sgMail.send(msg)
    return { success: true }
  } catch (e) {
    console.error('sendEmail error', e.response?.body ?? e.message)
    return { success: false, error: e.message }
  }
})

// ── 2. sendSMS ────────────────────────────────────────────────────────────────
exports.sendSMS = onCall({
  secrets: ['BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET'],
}, async (req) => {
  requireAuth(req)
  const { to, message } = req.data
  if (!to || !message) return { success: false, error: 'Missing to or message' }
  const cfg = getConfig()
  // Normalize to E.164 South Africa format
  const normalized = to.startsWith('0') ? '+27' + to.slice(1) : to
  try {
    const resp = await axios.post(
      'https://api.bulksms.com/v1/messages',
      [{ to: normalized, body: message }],
      {
        auth: { username: cfg.bulksmsTokenId, password: cfg.bulksmsTokenSecret },
        headers: { 'Content-Type': 'application/json' },
      }
    )
    return { success: true, data: resp.data }
  } catch (e) {
    console.error('sendSMS error', e.response?.data ?? e.message)
    return { success: false, error: e.message }
  }
})

// ── 3. sendWhatsApp ───────────────────────────────────────────────────────────
exports.sendWhatsApp = onCall({
  secrets: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER'],
}, async (req) => {
  requireAuth(req)
  const { to, message } = req.data
  if (!to || !message) return { success: false, error: 'Missing to or message' }
  const cfg = getConfig()
  const client = twilio(cfg.twilioSid, cfg.twilioToken)
  const normalized = to.startsWith('+') ? to : (to.startsWith('0') ? '+27' + to.slice(1) : '+27' + to)
  try {
    const msg = await client.messages.create({
      from: cfg.twilioWhatsapp,
      to: `whatsapp:${normalized}`,
      body: message,
    })
    return { success: true, sid: msg.sid }
  } catch (e) {
    console.error('sendWhatsApp error', e.message)
    return { success: false, error: e.message }
  }
})

// ── helpers for email tracking (used by scheduler + HTTP functions) ───────────

// Converts plain-text campaign body to a basic HTML email shell.
// HTML-mode bodies are returned as-is.
function resolveScheduledEmailBody(rawBody, emailMode) {
  if (emailMode === 'html') return rawBody
  const paragraphs = rawBody
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<div style="font-family:sans-serif;color:#333;max-width:600px;padding:16px">${paragraphs}</div>`
}

// Injects a 1×1 tracking pixel and (for HTML-mode emails) wraps every link
// through the /track/click redirect endpoint.
function injectCampaignTracking(html, uid, campaignId, contactId, emailMode) {
  const BASE = 'https://tlhiso.com'
  const r    = encodeURIComponent(String(contactId || 'unknown'))
  const pixel = `<img src="${BASE}/track/open?u=${uid}&c=${campaignId}&r=${r}" width="1" height="1" style="display:none;border:0" alt="">`

  let result = (emailMode === 'html')
    ? html.replace(/href="(https?:\/\/[^"]*?)"/gi, (_, href) => {
        if (href.includes('/track/')) return `href="${href}"`
        return `href="${BASE}/track/click?u=${uid}&c=${campaignId}&r=${r}&url=${encodeURIComponent(href)}"`
      })
    : html

  return result.includes('</body>')
    ? result.replace('</body>', `${pixel}</body>`)
    : result + pixel
}

// ── 4a. trackOpen (HTTP — serves 1×1 GIF, records open event) ─────────────────
exports.trackOpen = onRequest({ cors: true }, async (req, res) => {
  const { u: uid, c: campaignId, r: contactId } = req.query

  if (uid && campaignId) {
    const safeId  = String(contactId || 'unknown').slice(0, 128)
    const campRef = db.doc(`users/${uid}/campaigns/${campaignId}`)
    try {
      const openRef = campRef.collection('opens').doc(safeId)
      const openDoc = await openRef.get()
      if (!openDoc.exists) {
        await Promise.all([
          campRef.update({
            openCount:       admin.firestore.FieldValue.increment(1),
            uniqueOpenCount: admin.firestore.FieldValue.increment(1),
          }),
          openRef.set({
            firstOpened: admin.firestore.Timestamp.now(),
            lastOpened:  admin.firestore.Timestamp.now(),
            count: 1,
          }),
        ])
      } else {
        await Promise.all([
          campRef.update({ openCount: admin.firestore.FieldValue.increment(1) }),
          openRef.update({
            lastOpened: admin.firestore.Timestamp.now(),
            count: admin.firestore.FieldValue.increment(1),
          }),
        ])
      }
    } catch (e) {
      console.error('trackOpen error', e.message)
    }
  }

  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  res.set('Content-Type',  'image/gif')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.set('Pragma', 'no-cache')
  res.end(gif)
})

// ── 4b. trackClick (HTTP — records click, redirects to target URL) ─────────────
exports.trackClick = onRequest({ cors: false }, async (req, res) => {
  const { u: uid, c: campaignId, r: contactId, url } = req.query
  const raw       = url ? decodeURIComponent(String(url)) : ''
  const targetUrl = /^https?:\/\//i.test(raw) ? raw : 'https://tlhiso.com'

  if (uid && campaignId) {
    const safeId  = String(contactId || 'unknown').slice(0, 128)
    const campRef = db.doc(`users/${uid}/campaigns/${campaignId}`)
    try {
      const clickRef = campRef.collection('clicks').doc(safeId)
      const clickDoc = await clickRef.get()
      if (!clickDoc.exists) {
        await Promise.all([
          campRef.update({
            clickCount:       admin.firestore.FieldValue.increment(1),
            uniqueClickCount: admin.firestore.FieldValue.increment(1),
          }),
          clickRef.set({
            firstClicked: admin.firestore.Timestamp.now(),
            lastClicked:  admin.firestore.Timestamp.now(),
            count: 1,
            urls: [targetUrl],
          }),
        ])
      } else {
        await Promise.all([
          campRef.update({ clickCount: admin.firestore.FieldValue.increment(1) }),
          clickRef.update({
            lastClicked: admin.firestore.Timestamp.now(),
            count: admin.firestore.FieldValue.increment(1),
            urls: admin.firestore.FieldValue.arrayUnion(targetUrl),
          }),
        ])
      }
    } catch (e) {
      console.error('trackClick error', e.message)
    }
  }

  res.redirect(302, targetUrl)
})

// ── 4. transcribeConsultation ─────────────────────────────────────────────────
// Uses Google Cloud Speech-to-Text — no API key needed, authenticates via
// the Cloud Function's service account (same GCP project).
// Enable the API first: console.cloud.google.com → APIs → Cloud Speech-to-Text API
exports.transcribeConsultation = onCall({ timeoutSeconds: 540 }, async (req) => {
  requireAuth(req)
  const { storagePath } = req.data
  if (!storagePath) return { success: false, error: 'Missing storagePath' }

  // Derive encoding from file extension recorded by MedicalDashboard
  const ext      = storagePath.split('.').pop().toLowerCase()
  const encoding = { webm: 'WEBM_OPUS', ogg: 'OGG_OPUS', mp3: 'MP3', mpeg: 'MP3' }[ext] || 'WEBM_OPUS'
  const sampleRateHertz = ['WEBM_OPUS', 'OGG_OPUS'].includes(encoding) ? 48000 : undefined

  try {
    const bucketName = storage.bucket().name
    const gcsUri    = `gs://${bucketName}/${storagePath}`

    const [operation] = await speechClient.longRunningRecognize({
      config: {
        encoding,
        ...(sampleRateHertz && { sampleRateHertz }),
        audioChannelCount:          encoding === 'WEBM_OPUS' ? 2 : 1,
        languageCode:             'en-ZA',
        enableAutomaticPunctuation: true,
        model:                    'latest_long',
        useEnhanced:              true,
      },
      audio: { uri: gcsUri },
    })

    const [response] = await operation.promise()
    const transcript = response.results
        .map(r => r.alternatives[0]?.transcript ?? '')
        .join(' ')
        .trim()

    if (!transcript) return { success: false, error: 'No speech detected in audio' }
    return { success: true, transcript }
  } catch (e) {
    console.error('transcribeConsultation error', e.message)
    return { success: false, error: e.message }
  }
})

// ── 5. onUserCreated (Firestore trigger) ─────────────────────────────────────
// Fires when RegisterPage writes the new user doc to Firestore.
// Sends admin notification + welcome email to the registrant.
exports.notifyOnUserCreated = onDocumentCreated(
  { document: 'users/{userId}', secrets: ['SENDGRID_API_KEY'] },
  async (event) => {
    const data = event.data?.data()
    if (!data) return
    const { email, name, plan } = data
    if (!process.env.SENDGRID_API_KEY) return
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    try {
      // 1. Notify admin
      await sgMail.send({
        to: 'hello@tlhiso.com',
        from: { email: 'hello@tlhiso.com', name: 'Tlhiso' },
        subject: 'New user registration — action required',
        html: `
          <h2>New Tlhiso Registration</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Name:</strong> ${name ?? '(not set)'}</p>
          <p><strong>Plan:</strong> ${plan ?? 'starter'}</p>
          <p><strong>UID:</strong> ${event.params.userId}</p>
          <p><a href="https://tlhiso.com/superadmin/users"
            style="background:#5B8E7D;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">
            Activate in Admin Panel
          </a></p>
        `,
      })
      // 2. Welcome email to registrant
      await sgMail.send({
        to: email,
        from: { email: 'hello@tlhiso.com', name: 'Tlhiso' },
        subject: 'Your Tlhiso account is pending activation',
        html: `
          <h2>Welcome to Tlhiso, ${name ?? 'there'}!</h2>
          <p>Your account has been created and is <strong>pending activation</strong> by our team.</p>
          <p>You'll receive another email at <strong>${email}</strong> once your account is approved — usually within 24 hours.</p>
          <p style="color:#64748B;font-size:12px;margin-top:24px;">Questions? Email us at <a href="mailto:hello@tlhiso.com">hello@tlhiso.com</a></p>
        `,
      })
    } catch (e) {
      console.error('onUserCreated notification error', e.message)
    }
  }
)

// ── 7. processScheduledCampaigns (runs every 5 minutes) ──────────────────────
// Queries all users' campaigns where status == 'Scheduled' and
// scheduledFor <= now, resolves recipients server-side, sends via the same
// SendGrid / BulkSMS / Twilio logic, then updates the campaign doc.
// Throttles against each user's plan message limit.

// Campaign-only message quotas. Operational messages (booking confirmations,
// appointment reminders) are sent outside the scheduler and do NOT consume quota.
const PLAN_LIMITS = { starter: 1000, business: 3000, enterprise: 10000 }

// Monthly limit = plan allowance + any purchased top-up messages
function effectiveLimit(userData) {
  return (PLAN_LIMITS[userData.plan ?? 'starter'] ?? 1000) + (userData.topupMessages ?? 0)
}

// Next run for a recurring campaign/invoice. Times are entered in SAST
// (UTC+2) but Cloud Functions run in UTC, so we shift the hour by -2.
function computeNextRun(rec) {
  const [h, m] = String(rec.time || '09:00').split(':').map(Number)
  const now  = new Date()
  const next = new Date()
  next.setUTCHours((h ?? 9) - 2, m ?? 0, 0, 0)
  if (rec.freq === 'weekly') {
    const targetDow = rec.dayOfWeek ?? 1
    let add = (targetDow - next.getUTCDay() + 7) % 7
    if (add === 0 && next <= now) add = 7
    next.setUTCDate(next.getUTCDate() + add)
  } else {
    const dom = Math.min(rec.dayOfMonth ?? 1, 28)
    next.setUTCDate(dom)
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1, dom)
  }
  return admin.firestore.Timestamp.fromDate(next)
}

const CONTACT_COLLECTION = {
  medical:  'patients',
  b2b:      'customers',
  property: 'tenants',
  retail:   'customers',
}

function getContactName(c, industry) {
  if (industry === 'medical' || industry === 'property') {
    return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || ''
  }
  if (industry === 'b2b') return c.company || c.name || c.email || ''
  return c.name || c.email || ''
}

function normPhone(raw) {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  if (d.startsWith('27') && d.length === 11) return '+' + d
  if (d.startsWith('0') && d.length === 10)  return '+27' + d.slice(1)
  if (d.length === 9) return '+27' + d
  return '+' + d
}

function resolveRecipients(contacts, segDef, channel, industry, recentApptNames) {
  let pool = contacts.slice()

  if (segDef.mode === 'tagged' && segDef.tags?.length > 0) {
    pool = contacts.filter(c =>
      Array.isArray(c.tags) && segDef.tags.some(t => c.tags.includes(t))
    )
  } else if (segDef.mode === 'custom' && segDef.filters?.length > 0) {
    pool = contacts.filter(c =>
      segDef.filters.every(fKey => {
        switch (fKey) {
          case 'has_email':        return !!c.email
          case 'has_phone':        return !!c.phone
          case 'no_recent_appt':   return !recentApptNames.has(getContactName(c, industry))
          case 'has_chronic':      return Array.isArray(c.chronicConditions) && c.chronicConditions.length > 0
          case 'has_medical_aid':  return !!c.medicalAid
          case 'no_medical_aid':   return !c.medicalAid
          case 'lease_ending_60': {
            if (!c.leaseEnd) return false
            const diff = (new Date(c.leaseEnd) - new Date()) / 86400000
            return diff >= 0 && diff <= 60
          }
          case 'lease_ending_30': {
            if (!c.leaseEnd) return false
            const diff = (new Date(c.leaseEnd) - new Date()) / 86400000
            return diff >= 0 && diff <= 30
          }
          case 'birthday_month': {
            const raw = c.birthday || c.dob
            if (!raw) return false
            return new Date(raw).getMonth() === new Date().getMonth()
          }
          default: return true
        }
      })
    )
  }

  // Exclude opted-out contacts
  pool = pool.filter(c => c.marketingOptOut !== true)

  // Filter by channel contact requirement
  return pool.filter(c => channel === 'email' ? !!c.email : !!c.phone)
}

exports.processScheduledCampaigns = onSchedule(
  {
    schedule: 'every 5 minutes',
    secrets: [
      'SENDGRID_API_KEY',
      'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER',
    ],
  },
  async () => {
    const now = admin.firestore.Timestamp.now()
    const cfg = getConfig()

    // Query all scheduled campaigns across all users due now
    const snap = await db.collectionGroup('campaigns')
      .where('status', '==', 'Scheduled')
      .where('scheduledFor', '<=', now)
      .get()

    if (snap.empty) return

    console.log(`[scheduler] ${snap.size} scheduled campaign(s) due`)

    for (const campDoc of snap.docs) {
      const camp = campDoc.data()
      const uid  = campDoc.ref.parent.parent?.id
      if (!uid) continue

      try {
        // Load user doc for plan limits
        const userSnap = await db.doc(`users/${uid}`).get()
        const userData  = userSnap.data() ?? {}
        const limit     = effectiveLimit(userData)
        const used      = userData.messagesUsed ?? 0
        const remaining = limit - used

        if (remaining <= 0) {
          await campDoc.ref.update({ status: 'QuotaExceeded', processedAt: admin.firestore.Timestamp.now() })
          console.log(`[scheduler] uid=${uid} quota exhausted, skipping campaign ${campDoc.id}`)
          continue
        }

        // Mark as Sending immediately to prevent double-processing
        await campDoc.ref.update({ status: 'Sending' })

        const industry = camp.industry
        const channel  = camp.channel
        const segDef   = camp.segmentDefinition ?? { mode: 'all', tags: [], filters: [] }
        const body     = camp.body ?? ''

        // Load contacts
        const contactCol = CONTACT_COLLECTION[industry] ?? 'customers'
        const contactSnap = await db.collection(`users/${uid}/${contactCol}`).get()
        const contacts    = contactSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Load recent appointments for no_recent_appt filter
        let recentApptNames = new Set()
        if (segDef.filters?.includes('no_recent_appt')) {
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - 90)
          const cutoffStr = cutoff.toISOString().slice(0, 10)
          const apptSnap = await db.collection(`users/${uid}/appointments`)
            .where('date', '>=', cutoffStr).get()
          apptSnap.docs.forEach(d => {
            const a = d.data()
            if (a.patient) recentApptNames.add(a.patient)
          })
        }

        // Resolve recipients and respect remaining quota
        let recipients = resolveRecipients(contacts, segDef, channel, industry, recentApptNames)
        if (recipients.length > remaining) {
          recipients = recipients.slice(0, remaining)
        }

        let sent = 0, failed = 0

        for (const contact of recipients) {
          const name    = getContactName(contact, industry)
          const msgBody = body.replace(/\{name\}/gi, name)

          try {
            if (channel === 'email') {
              const emailHtml = resolveScheduledEmailBody(msgBody, camp.emailMode)
              const tracked   = injectCampaignTracking(emailHtml, uid, campDoc.id, contact.id, camp.emailMode)
              sgMail.setApiKey(cfg.sendgridKey)
              await sgMail.send({
                to:      contact.email,
                from:    { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
                subject: camp.subject || 'Message from your service',
                html:    tracked,
              })
            } else if (channel === 'sms') {
              const to = normPhone(contact.phone)
              await axios.post(
                'https://api.bulksms.com/v1/messages',
                [{ to, body: msgBody }],
                { auth: { username: cfg.bulksmsTokenId, password: cfg.bulksmsTokenSecret } }
              )
            } else if (channel === 'whatsapp') {
              const client = twilio(cfg.twilioSid, cfg.twilioToken)
              const to = normPhone(contact.phone)
              await client.messages.create({
                from: cfg.twilioWhatsapp,
                to:   `whatsapp:${to}`,
                body: msgBody,
              })
            }
            sent++
            // Log success to the user's messages subcollection
            db.collection(`users/${uid}/messages`).add({
              to:         channel === 'email' ? contact.email : normPhone(contact.phone),
              type:       channel,
              body:       msgBody,
              status:     'sent',
              module:     'campaigns',
              campaignId: campDoc.id,
              sentAt:     admin.firestore.Timestamp.now(),
            }).catch(e => console.error('[scheduler] message log failed:', e.message))
          } catch (err) {
            console.error(`[scheduler] send failed for contact ${contact.id}:`, err.message)
            failed++
            // Log failure so the Messages tab reflects the real outcome
            await db.collection(`users/${uid}/messages`).add({
              to:         channel === 'email' ? contact.email : normPhone(contact.phone),
              type:       channel,
              body:       msgBody,
              status:     'failed',
              module:     'campaigns',
              campaignId: campDoc.id,
              sentAt:     admin.firestore.Timestamp.now(),
            }).catch(e => console.error('[scheduler] failure log failed:', e.message))
          }
        }

        const finalStatus = failed === 0 ? 'Sent' : sent === 0 ? 'Failed' : 'Partial'

        await campDoc.ref.update({
          status:      finalStatus,
          sentCount:   sent,
          failedCount: failed,
          sentAt:      admin.firestore.Timestamp.now(),
        })

        // Increment the user's messagesUsed
        if (sent > 0) {
          await db.doc(`users/${uid}`).update({
            messagesUsed: admin.firestore.FieldValue.increment(sent),
          })
        }

        console.log(`[scheduler] campaign ${campDoc.id} → ${finalStatus} (${sent} sent, ${failed} failed)`)
      } catch (err) {
        console.error(`[scheduler] error processing campaign ${campDoc.id}:`, err.message)
        // Reset to Scheduled so it will retry on the next tick
        await campDoc.ref.update({ status: 'Scheduled' }).catch(() => {})
      }
    }
  }
)

// ── 7b. processRecurringCampaigns (runs every 5 minutes) ──────────────────────
// Recurring campaign docs keep status 'Recurring' and carry
// recurrence { freq: 'weekly'|'monthly', dayOfWeek?, dayOfMonth?, time } and a
// nextRunAt Timestamp. Each due run sends to the (re-resolved) audience,
// accumulates totals on the same doc, and advances nextRunAt.
exports.processRecurringCampaigns = onSchedule(
  {
    schedule: 'every 5 minutes',
    secrets: [
      'SENDGRID_API_KEY',
      'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER',
    ],
  },
  async () => {
    const now = admin.firestore.Timestamp.now()
    const cfg = getConfig()

    const snap = await db.collectionGroup('campaigns')
      .where('status', '==', 'Recurring')
      .where('nextRunAt', '<=', now)
      .get()

    if (snap.empty) return
    console.log(`[recurring] ${snap.size} recurring campaign(s) due`)

    for (const campDoc of snap.docs) {
      const camp = campDoc.data()
      const uid  = campDoc.ref.parent.parent?.id
      if (!uid || !camp.recurrence) continue

      // Advance nextRunAt FIRST so a crash can't double-send on the next tick
      const nextRunAt = computeNextRun(camp.recurrence)
      await campDoc.ref.update({ nextRunAt })

      try {
        const userSnap  = await db.doc(`users/${uid}`).get()
        const userData  = userSnap.data() ?? {}
        const remaining = effectiveLimit(userData) - (userData.messagesUsed ?? 0)
        if (remaining <= 0) {
          console.log(`[recurring] uid=${uid} quota exhausted, skipping run of ${campDoc.id}`)
          continue
        }

        const industry = camp.industry
        const channel  = camp.channel
        const segDef   = camp.segmentDefinition ?? { mode: 'all', tags: [], filters: [] }
        const body     = camp.body ?? ''

        const contactCol  = CONTACT_COLLECTION[industry] ?? 'customers'
        const contactSnap = await db.collection(`users/${uid}/${contactCol}`).get()
        const contacts    = contactSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        let recentApptNames = new Set()
        if (segDef.filters?.includes('no_recent_appt')) {
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - 90)
          const apptSnap = await db.collection(`users/${uid}/appointments`)
            .where('date', '>=', cutoff.toISOString().slice(0, 10)).get()
          apptSnap.docs.forEach(d => { const a = d.data(); if (a.patient) recentApptNames.add(a.patient) })
        }

        let recipients = resolveRecipients(contacts, segDef, channel, industry, recentApptNames)
        if (recipients.length > remaining) recipients = recipients.slice(0, remaining)

        let sent = 0, failed = 0
        for (const contact of recipients) {
          const name    = getContactName(contact, industry)
          const msgBody = body.replace(/\{name\}/gi, name)
          try {
            if (channel === 'email') {
              const emailHtml = resolveScheduledEmailBody(msgBody, camp.emailMode)
              const tracked   = injectCampaignTracking(emailHtml, uid, campDoc.id, contact.id, camp.emailMode)
              sgMail.setApiKey(cfg.sendgridKey)
              await sgMail.send({
                to: contact.email,
                from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
                subject: camp.subject || 'Message from your service',
                html: tracked,
              })
            } else if (channel === 'sms') {
              await axios.post(
                'https://api.bulksms.com/v1/messages',
                [{ to: normPhone(contact.phone), body: msgBody }],
                { auth: { username: cfg.bulksmsTokenId, password: cfg.bulksmsTokenSecret } }
              )
            } else if (channel === 'whatsapp') {
              const client = twilio(cfg.twilioSid, cfg.twilioToken)
              await client.messages.create({
                from: cfg.twilioWhatsapp,
                to: `whatsapp:${normPhone(contact.phone)}`,
                body: msgBody,
              })
            }
            sent++
            db.collection(`users/${uid}/messages`).add({
              to: channel === 'email' ? contact.email : normPhone(contact.phone),
              type: channel, body: msgBody, status: 'sent',
              module: 'campaigns', campaignId: campDoc.id,
              sentAt: admin.firestore.Timestamp.now(),
            }).catch(() => {})
          } catch (err) {
            failed++
            db.collection(`users/${uid}/messages`).add({
              to: channel === 'email' ? contact.email : normPhone(contact.phone),
              type: channel, body: msgBody, status: 'failed',
              module: 'campaigns', campaignId: campDoc.id,
              sentAt: admin.firestore.Timestamp.now(),
            }).catch(() => {})
          }
        }

        await campDoc.ref.update({
          sentCount:   admin.firestore.FieldValue.increment(sent),
          failedCount: admin.firestore.FieldValue.increment(failed),
          runCount:    admin.firestore.FieldValue.increment(1),
          lastRunAt:   admin.firestore.Timestamp.now(),
        })
        if (sent > 0) {
          await db.doc(`users/${uid}`).update({
            messagesUsed: admin.firestore.FieldValue.increment(sent),
          })
        }
        console.log(`[recurring] ${campDoc.id} run complete (${sent} sent, ${failed} failed)`)
      } catch (err) {
        console.error(`[recurring] error on ${campDoc.id}:`, err.message)
      }
    }
  }
)

// ── 6. deleteUserAccount (called from super admin) ───────────────────────────
// Deletes both the Firestore profile doc and the Firebase Auth account so the
// user cannot log in again. Only callable by the super admin.
exports.deleteUserAccount = onCall(async (req) => {
  requireSuperAdmin(req)
  const { uid } = req.data
  if (!uid) return { success: false, error: 'Missing uid' }
  try {
    await admin.auth().deleteUser(uid)
  } catch (e) {
    // If the Auth account is already gone, continue to clean up Firestore
    if (e.code !== 'auth/user-not-found') {
      console.error('deleteUserAccount auth error', e.message)
      return { success: false, error: e.message }
    }
  }
  try {
    await db.doc(`users/${uid}`).delete()
    return { success: true }
  } catch (e) {
    console.error('deleteUserAccount firestore error', e.message)
    return { success: false, error: e.message }
  }
})

// ── 7. sendActivationEmail (called from super admin) ─────────────────────────
exports.sendActivationEmail = onCall({ secrets: ['SENDGRID_API_KEY'] }, async (req) => {
  requireSuperAdmin(req)
  const { uid } = req.data
  if (!uid) return { success: false, error: 'Missing uid' }
  const cfg = getConfig()
  try {
    const snap = await db.doc(`users/${uid}`).get()
    const user = snap.data()
    if (!user) return { success: false, error: 'User not found' }
    sgMail.setApiKey(cfg.sendgridKey)
    await sgMail.send({
      to: user.email,
      from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
      subject: 'Your Tlhiso account is now active!',
      html: `
        <h2>Welcome to Tlhiso!</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>Your <strong>${user.plan ?? 'Starter'}</strong> account is now active and ready to use.</p>
        <p><a href="https://tlhiso.com/login" style="background:#5B8E7D;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">Login to Tlhiso</a></p>
        <p style="color:#64748B;font-size:12px;margin-top:24px;">Need help? Contact us at hello@tlhiso.com</p>
      `,
    })
    return { success: true }
  } catch (e) {
    console.error('sendActivationEmail error', e.message)
    return { success: false, error: e.message }
  }
})

// ── 8a. sendAdminCampaign ─────────────────────────────────────────────────────
// Super admin sends a marketing email campaign to all subscribed users (or a
// filtered audience).  Saves a campaign record to /superadmin/campaigns/{id}.
exports.sendAdminCampaign = onCall({ timeoutSeconds: 120, secrets: ['SENDGRID_API_KEY'] }, async (req) => {
  requireSuperAdmin(req)
  const { subject, htmlBody, audience = 'all' } = req.data
  if (!subject || !htmlBody) throw new HttpsError('invalid-argument', 'subject and htmlBody are required')

  const cfg = getConfig()
  sgMail.setApiKey(cfg.sendgridKey)

  // Build Firestore query based on audience filter
  let q = admin.firestore().collection('users').where('marketingConsent', '==', true).where('isActive', '==', true)
  if (audience !== 'all') q = q.where('industry', '==', audience)

  const snap = await q.get()
  const recipients = snap.docs.map(d => ({ email: d.data().email, name: d.data().name || '' }))

  if (recipients.length === 0) {
    return { success: true, sentCount: 0, message: 'No subscribed users matched the audience.' }
  }

  // SendGrid allows up to 1000 personalizations per request — batch just in case
  const BATCH = 900
  let sentCount = 0
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    await sgMail.send({
      personalizations: batch.map(r => ({ to: [{ email: r.email, name: r.name }] })),
      from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
      subject,
      html: htmlBody,
    })
    sentCount += batch.length
  }

  // Save campaign record
  await admin.firestore().collection('superadmin').doc('data').collection('campaigns').add({
    subject,
    htmlBody,
    audience,
    sentCount,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
    sentBy: req.auth?.token?.email || 'superadmin',
  })

  return { success: true, sentCount }
})

// ── 8. createPayfastCheckout ──────────────────────────────────────────────────
// Generates a PayFast Onsite payment UUID for the authenticated user's plan.
// Returns { uuid } — client passes this to window.payfast_do_onsite_payment().
const PLAN_PRICES = {
  starter:    { amount: '699.00',  name: 'Tlhiso Starter Plan' },
  business:   { amount: '2699.00', name: 'Tlhiso Professional Plan' },
  enterprise: { amount: '4999.00', name: 'Tlhiso Business Plan' },
}

function pfSignature(fields, passphrase) {
  const pfString = Object.entries(fields)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&')
  const pp = passphrase ? passphrase.trim() : null
  const toSign = pp
    ? `${pfString}&passphrase=${encodeURIComponent(pp).replace(/%20/g, '+')}`
    : pfString
  return crypto.createHash('md5').update(toSign).digest('hex')
}

exports.createPayfastCheckout = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE'],
}, async (req) => {
  requireAuth(req)
  const uid = req.auth.uid

  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) throw new HttpsError('not-found', 'User profile not found.')

  const user = userSnap.data()
  const planKey = user.plan || 'starter'
  const planData = PLAN_PRICES[planKey] || PLAN_PRICES.starter

  const merchantId  = process.env.PAYFAST_MERCHANT_ID
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY
  const isSandbox   = merchantId === '10000100'
  const host        = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'

  const nameParts = (user.name || 'User').trim().split(/\s+/)
  // First real charge happens 30 days from today — today is free (R0)
  const trialEnd  = new Date(); trialEnd.setDate(trialEnd.getDate() + 30)
  const billingDate = trialEnd.toISOString().slice(0, 10)

  const fields = {
    merchant_id:       merchantId,
    merchant_key:      merchantKey,
    return_url:        'https://tlhiso.com/checkout/complete',
    cancel_url:        'https://tlhiso.com/checkout',
    notify_url:        'https://us-central1-tlhiso.cloudfunctions.net/payfastIPN',
    name_first:        nameParts[0],
    name_last:         nameParts.slice(1).join(' ') || 'User',
    email_address:     user.email,
    m_payment_id:      uid,
    amount:            '10.00',
    item_name:         `${planData.name} - 30-Day Trial`,
    custom_str1:       planKey,
    custom_str2:       'trial',
    subscription_type: '1',
    billing_date:      billingDate,
    recurring_amount:  planData.amount,
    frequency:         '3',
    cycles:            '0',
  }
  fields.signature = pfSignature(fields, process.env.PAYFAST_PASSPHRASE)

  const body = Object.entries(fields)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&')

  try {
    const resp = await axios.post(
      `https://${host}/onsite/process`,
      body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    if (!resp.data?.uuid) throw new Error(JSON.stringify(resp.data))
    return { uuid: resp.data.uuid, sandbox: isSandbox }
  } catch (e) {
    const raw = typeof e.response?.data === 'string' ? e.response.data : ''
    const text = raw.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    console.error('createPayfastCheckout status:', e.response?.status)
    console.error('createPayfastCheckout pf_text:', text.slice(0, 500) || e.message)
    throw new HttpsError('internal', 'Failed to initiate payment. Please try again.')
  }
})

// ── 9. payfastIPN ─────────────────────────────────────────────────────────────
// Receives PayFast Instant Payment Notification (IPN).
// Verifies the signature, then activates the user and sends a welcome email.
exports.payfastIPN = onRequest({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_PASSPHRASE', 'SENDGRID_API_KEY'],
}, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

  const data = { ...req.body }
  const receivedSig = data.signature
  delete data.signature

  // Verify signature
  const expectedSig = pfSignature(data, process.env.PAYFAST_PASSPHRASE)
  if (receivedSig !== expectedSig) {
    console.error('payfastIPN: signature mismatch', { received: receivedSig, expected: expectedSig })
    res.status(400).send('Invalid signature')
    return
  }

  const uid           = data.m_payment_id
  const paymentStatus = data.payment_status
  const pfPaymentId   = data.pf_payment_id

  if (!uid) { res.status(400).send('Missing m_payment_id'); return }

  // Quota top-up purchases: m_payment_id = topup_<uid>_<bundleKey>_<timestamp>
  if (String(uid).startsWith('topup_')) {
    if (paymentStatus === 'COMPLETE') {
      try {
        const [, realUid, bundleKey] = String(uid).split('_')
        const bundle = TOPUP_BUNDLES[bundleKey]
        if (realUid && bundle) {
          const dupRef = db.collection('payfast_payments').doc(String(pfPaymentId || uid))
          const dup = await dupRef.get()
          if (!dup.exists) {
            await Promise.all([
              db.doc(`users/${realUid}`).update({
                topupMessages: admin.firestore.FieldValue.increment(bundle.messages),
              }),
              dupRef.set({
                uid: realUid, type: 'topup', bundle: bundleKey,
                messages: bundle.messages, amount: data.amount_gross ?? null,
                at: admin.firestore.Timestamp.now(),
              }),
            ])
            console.log(`payfastIPN: top-up ${bundleKey} (+${bundle.messages} msgs) for uid=${realUid}`)
          }
        }
      } catch (e) {
        console.error('payfastIPN top-up error', e.message)
        res.status(500).send('Top-up error')
        return
      }
    }
    res.status(200).send('OK')
    return
  }

  // Events activation payments: m_payment_id = evtact_<uid>
  if (String(uid).startsWith('evtact_')) {
    if (paymentStatus === 'COMPLETE') {
      try {
        const realUid = String(uid).slice('evtact_'.length)
        const dupRef = db.collection('payfast_payments').doc(String(pfPaymentId || uid))
        if (!(await dupRef.get()).exists) {
          await db.doc(`users/${realUid}`).update({
            isActive: true, eventsActivated: true,
            paymentStatus: 'events', trialActive: false,
          })
          await dupRef.set({ uid: realUid, type: 'events_activation', amount: data.amount_gross ?? null, at: admin.firestore.Timestamp.now() })
          console.log(`payfastIPN: events activation uid=${realUid}`)
        }
      } catch (e) {
        console.error('payfastIPN evtact error', e.message)
        res.status(500).send('Activation error')
        return
      }
    }
    res.status(200).send('OK'); return
  }

  // Per-event payments: m_payment_id = evt_<eventId>
  if (String(uid).startsWith('evt_')) {
    if (paymentStatus === 'COMPLETE') {
      try {
        const eventId = String(uid).slice('evt_'.length)
        const dupRef = db.collection('payfast_payments').doc(String(pfPaymentId || uid))
        if (!(await dupRef.get()).exists) {
          await db.doc(`events/${eventId}`).update({
            paymentStatus: 'paid', status: 'launched',
            amountChargedZar: parseFloat(data.amount_gross || '0'),
            launchedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          await dupRef.set({ eventId, type: 'event_launch', amount: data.amount_gross ?? null, at: admin.firestore.Timestamp.now() })
          console.log(`payfastIPN: event launched eventId=${eventId}`)
        }
      } catch (e) {
        console.error('payfastIPN evt error', e.message)
        res.status(500).send('Event launch error')
        return
      }
    }
    res.status(200).send('OK'); return
  }

  if (paymentStatus === 'COMPLETE') {
    try {
      const cfg = getConfig()
      sgMail.setApiKey(cfg.sendgridKey)
      const userSnap  = await db.collection('users').doc(uid).get()
      const user      = userSnap.data() || {}
      const planKey   = data.custom_str1 || user.plan || 'starter'
      const pfToken   = data.token || null
      const amountGross = parseFloat(data.amount_gross || '0')
      const isTrial   = data.custom_str2 === 'trial' || amountGross <= 10

      const PLAN_QUOTAS = { starter: 1000, business: 3000, enterprise: 10000 }

      if (isTrial) {
        // Card captured, no charge — activate trial
        const trialEndsAt = new Date(); trialEndsAt.setDate(trialEndsAt.getDate() + 30)
        await db.collection('users').doc(uid).update({
          isActive:             true,
          paymentMethod:        'payfast',
          paymentStatus:        'trial',
          trialActive:          true,
          trialStartedAt:       admin.firestore.FieldValue.serverTimestamp(),
          trialEndsAt:          admin.firestore.Timestamp.fromDate(trialEndsAt),
          trialMessagesLimit:   30,
          messagesUsed:         0,
          payfastPaymentId:     pfPaymentId || null,
          ...(pfToken && { pfSubscriptionToken: pfToken }),
        })
        if (user.email) {
          await sgMail.send({
            to: user.email,
            from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
            subject: '🎉 Your 30-day Tlhiso trial has started!',
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
                <h2 style="color:#5B8E7D">Welcome to Tlhiso!</h2>
                <p>Hi ${user.name || 'there'},</p>
                <p>Your <strong>30-day trial</strong> is now active. R10 was charged today to activate it. You have <strong>30 campaign messages</strong> to explore the platform.</p>
                <p>Your first full subscription charge of <strong>R${parseFloat(PLAN_PRICES[planKey]?.amount || 0).toLocaleString('en-ZA')}/month</strong> will be billed automatically on <strong>${trialEndsAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>
                <p>You can cancel anytime before then.</p>
                <p style="margin:24px 0"><a href="https://tlhiso.com/login" style="background:#5B8E7D;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Go to my dashboard →</a></p>
                <p style="color:#64748B;font-size:12px;margin-top:24px;">Questions? <a href="mailto:hello@tlhiso.com" style="color:#5B8E7D">hello@tlhiso.com</a></p>
              </div>`,
          })
        }
        console.log(`payfastIPN: trial activated uid=${uid}`)
      } else {
        // Real recurring payment — full subscription active
        const quota = PLAN_QUOTAS[planKey] ?? PLAN_QUOTAS.starter
        await db.collection('users').doc(uid).update({
          isActive:             true,
          isPaid:               true,
          paymentMethod:        'payfast',
          paymentStatus:        'active',
          trialActive:          false,
          planMessagesQuota:    quota,
          messagesUsed:         0,
          paidAt:               admin.firestore.FieldValue.serverTimestamp(),
          payfastPaymentId:     pfPaymentId || null,
          ...(pfToken && { pfSubscriptionToken: pfToken }),
        })
        if (user.email) {
          await sgMail.send({
            to: user.email,
            from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
            subject: '✅ Payment received — your Tlhiso subscription is active',
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
                <h2 style="color:#5B8E7D">Payment Confirmed</h2>
                <p>Hi ${user.name || 'there'},</p>
                <p>Your payment of <strong>R${amountGross.toLocaleString('en-ZA')}</strong> was received. Your <strong>${PLAN_PRICES[planKey]?.name || 'Tlhiso'}</strong> subscription is active and your message quota has been reset.</p>
                <p style="margin:24px 0"><a href="https://tlhiso.com/login" style="background:#5B8E7D;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Go to my dashboard →</a></p>
                <p style="color:#64748B;font-size:12px;margin-top:24px;">Questions? <a href="mailto:hello@tlhiso.com" style="color:#5B8E7D">hello@tlhiso.com</a></p>
              </div>`,
          })
        }
        console.log(`payfastIPN: payment received uid=${uid}, amount=${amountGross}`)
      }
    } catch (e) {
      console.error('payfastIPN: activation error', e.message)
      res.status(500).send('Activation error')
      return
    }
  } else if (paymentStatus === 'CANCELLED') {
    try {
      await db.collection('users').doc(uid).update({ paymentStatus: 'cancelled', isActive: false, isPaid: false })
      console.log(`payfastIPN: subscription cancelled uid=${uid}`)
    } catch (e) { console.error('payfastIPN: cancel error', e.message) }
  } else {
    console.log(`payfastIPN: status=${paymentStatus} for uid=${uid} — no action`)
  }

  res.status(200).send('OK')
})

// ── 11. unsubscribeContact ────────────────────────────────────────────────────
// Decodes a base64 token containing { uid, col, id } and sets
// marketingOptOut: true on the contact document. No auth required — the
// contact ID itself is a random Firestore auto-ID which acts as the secret.
const ALLOWED_CONTACT_COLS = new Set(['customers', 'patients', 'tenants'])
exports.unsubscribeContact = onCall({ cors: true }, async (req) => {
  const { token } = req.data
  if (!token || typeof token !== 'string') throw new HttpsError('invalid-argument', 'Token required')

  let uid, col, id
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    uid = decoded.uid; col = decoded.col; id = decoded.id
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid token')
  }

  if (!uid || !col || !id) throw new HttpsError('invalid-argument', 'Incomplete token')
  if (!ALLOWED_CONTACT_COLS.has(col)) throw new HttpsError('invalid-argument', 'Unknown collection')

  try {
    await db.doc(`users/${uid}/${col}/${id}`).update({ marketingOptOut: true })
    return { success: true }
  } catch (e) {
    throw new HttpsError('internal', 'Could not update contact')
  }
})

// ── smsDeliveryWebhook ────────────────────────────────────────────────────────
// BulkSMS POSTs delivery receipts here. Must return 200 quickly or BulkSMS
// retries and eventually stops sending. We log receipts to sms_delivery_logs
// for visibility but never let a log failure block the 200 response.
exports.smsDeliveryWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }

  try {
    const receipts = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : [])
    if (receipts.length > 0) {
      const batch = db.batch()
      for (const receipt of receipts) {
        batch.set(db.collection('sms_delivery_logs').doc(), {
          messageId:  receipt.id        ?? null,
          to:         receipt.to        ?? null,
          statusType: receipt.status?.type ?? null,
          statusId:   receipt.status?.id   ?? null,
          eventType:  receipt.type      ?? null,
          body:       receipt.body      ?? null,
          creditCost: receipt.creditCost ?? null,
          parts:      receipt.numberOfParts ?? null,
          submittedAt: receipt.submission?.date ?? null,
          receivedAt: admin.firestore.Timestamp.now(),
        })
      }
      await batch.commit()
    }
  } catch (e) {
    console.error('smsDeliveryWebhook log error', e.message)
  }

  res.status(200).send('OK')
})

exports.shortenUrl = onCall({ cors: true }, async (req) => {
  const { url } = req.data
  if (!url) throw new HttpsError('invalid-argument', 'URL is required')
  try {
    const resp = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`)
    const short = String(resp.data || '').trim()
    if (!short.startsWith('http')) throw new Error('Unexpected response from is.gd')
    return { shortUrl: short }
  } catch (e) {
    throw new HttpsError('internal', 'Could not shorten URL')
  }
})

// ── 10. processAutomations (runs every 60 minutes) ────────────────────────────
// For each active automation, finds contacts that match the trigger + delay
// window and sends them the configured message (SMS / Email / WhatsApp).
// Tracks sent contacts in /users/{uid}/automations/{aid}/runs/{contactId}
// to prevent duplicate sends.
exports.processAutomations = onSchedule(
  {
    schedule: 'every 60 minutes',
    secrets: [
      'SENDGRID_API_KEY',
      'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER',
    ],
  },
  async () => {
    const now = new Date()
    const cfg = getConfig()
    const WINDOW_MS = 70 * 60 * 1000 // 70-min window to absorb scheduler jitter

    // All active automations across all users
    const autoSnap = await db.collectionGroup('automations')
      .where('active', '==', true)
      .get()

    if (autoSnap.empty) return
    console.log(`[automations] ${autoSnap.size} active automation(s)`)

    for (const autoDoc of autoSnap.docs) {
      const auto = autoDoc.data()
      const uid  = autoDoc.ref.parent.parent?.id
      if (!uid) continue

      const contactCol = CONTACT_COLLECTION[auto.industry] ?? 'customers'

      try {
        // Load user plan for quota check
        const userSnap  = await db.doc(`users/${uid}`).get()
        const userData  = userSnap.data() ?? {}
        const limit     = effectiveLimit(userData)
        const used      = userData.messagesUsed ?? 0
        if (used >= limit) {
          console.log(`[automations] uid=${uid} quota exhausted, skipping`)
          continue
        }
        let quota = limit - used

        // Contacts already sent this automation
        const runsSnap  = await db.collection(`users/${uid}/automations/${autoDoc.id}/runs`).get()
        const alreadyRun = new Set(runsSnap.docs.map(d => d.id))

        // All contacts for this user/industry
        const contactSnap = await db.collection(`users/${uid}/${contactCol}`).get()
        const contacts    = contactSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        const candidates = []

        for (const contact of contacts) {
          if (contact.marketingOptOut) continue
          // Channel reachability check
          if (auto.channel === 'email' && !contact.email) continue
          if ((auto.channel === 'sms' || auto.channel === 'whatsapp') && !contact.phone) continue

          let matches = false

          switch (auto.trigger) {
            case 'new_contact': {
              if (alreadyRun.has(contact.id)) break // only once per contact
              const created = contact.createdAt?.toDate?.()
              if (!created) break
              const delayMs = (auto.delay ?? 0) * 60 * 1000
              const target  = new Date(created.getTime() + delayMs)
              if (Math.abs(now - target) <= WINDOW_MS) matches = true
              break
            }

            case 'appointment_booked': {
              if (alreadyRun.has(contact.id)) break
              // Find the most recent appointment linked to this contact
              const nameKey = auto.industry === 'medical' ? 'patient' : 'customer'
              const contactName = getContactName(contact, auto.industry)
              const apptSnap = await db.collection(`users/${uid}/appointments`)
                .where(nameKey, '==', contactName)
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get()
              if (apptSnap.empty) break
              const apptCreated = apptSnap.docs[0].data().createdAt?.toDate?.()
              if (!apptCreated) break
              const delayMs = (auto.delay ?? 0) * 60 * 1000
              const target  = new Date(apptCreated.getTime() + delayMs)
              if (Math.abs(now - target) <= WINDOW_MS) matches = true
              break
            }

            case 'birthday': {
              // auto.delay: 0 = on the day, -60 = 1 day before (stored as minutes before)
              const dobRaw = contact.dateOfBirth || contact.birthDate
              if (!dobRaw) break
              const dob = typeof dobRaw === 'string' ? new Date(dobRaw) : dobRaw.toDate?.()
              if (!dob || isNaN(dob)) break
              const target = new Date(now)
              if (auto.delay < 0) target.setMinutes(target.getMinutes() + Math.abs(auto.delay))
              if (dob.getDate() !== target.getDate() || dob.getMonth() !== target.getMonth()) break
              // Only send once per year — check if last run was in a previous year
              const lastRun = runsSnap.docs.find(d => d.id === contact.id)?.data()?.sentAt?.toDate?.()
              if (lastRun && lastRun.getFullYear() >= now.getFullYear()) break
              matches = true
              break
            }

            case 'inactive': {
              if (alreadyRun.has(contact.id)) break
              // auto.delay is in days for this trigger
              const inactiveDays = auto.delay ?? 30
              const cutoff = new Date(now.getTime() - inactiveDays * 24 * 60 * 60 * 1000)
              // Check most recent message to this contact
              const toValues = [contact.phone ? normPhone(contact.phone) : null, contact.email].filter(Boolean)
              let lastContact = null
              for (const toVal of toValues) {
                const msgSnap = await db.collection(`users/${uid}/messages`)
                  .where('to', '==', toVal)
                  .orderBy('sentAt', 'desc')
                  .limit(1)
                  .get()
                if (!msgSnap.empty) {
                  const d = msgSnap.docs[0].data().sentAt?.toDate?.()
                  if (d && (!lastContact || d > lastContact)) lastContact = d
                }
              }
              // If never messaged, use contact creation date as proxy
              if (!lastContact) {
                const created = contact.createdAt?.toDate?.()
                lastContact = created ?? new Date(0)
              }
              if (lastContact < cutoff) matches = true
              break
            }
          }

          if (matches) candidates.push(contact)
        }

        if (candidates.length === 0) continue
        const toSend = candidates.slice(0, quota)
        console.log(`[automations] auto=${autoDoc.id} trigger=${auto.trigger} sending=${toSend.length}`)

        let sent = 0
        for (const contact of toSend) {
          const name = getContactName(contact, auto.industry)
          const resolved = (auto.body ?? '')
            .replace(/\{name\}/gi,    name)
            .replace(/\{email\}/gi,   contact.email  ?? '')
            .replace(/\{phone\}/gi,   contact.phone  ?? '')
            .replace(/\{company\}/gi, contact.company ?? '')

          try {
            if (auto.channel === 'email') {
              const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#333;padding:24px;max-width:600px;margin:0 auto">${resolved.replace(/\n/g, '<br>')}</body></html>`
              sgMail.setApiKey(cfg.sendgridKey)
              await sgMail.send({
                to:      contact.email,
                from:    { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
                subject: auto.subject || 'Message from your service',
                html,
              })
            } else if (auto.channel === 'sms') {
              await axios.post(
                'https://api.bulksms.com/v1/messages',
                [{ to: normPhone(contact.phone), body: resolved }],
                { auth: { username: cfg.bulksmsTokenId, password: cfg.bulksmsTokenSecret } }
              )
            } else if (auto.channel === 'whatsapp') {
              const client = twilio(cfg.twilioSid, cfg.twilioToken)
              await client.messages.create({
                from: cfg.twilioWhatsapp,
                to:   `whatsapp:${normPhone(contact.phone)}`,
                body: resolved,
              })
            }

            sent++
            const to = auto.channel === 'email' ? contact.email : normPhone(contact.phone)

            // Log to messages subcollection
            db.collection(`users/${uid}/messages`).add({
              to, type: auto.channel, body: resolved,
              status: 'sent', module: 'automations',
              automationId: autoDoc.id, sentAt: admin.firestore.Timestamp.now(),
            }).catch(() => {})

            // Mark this contact as run for this automation
            await db.doc(`users/${uid}/automations/${autoDoc.id}/runs/${contact.id}`).set({
              sentAt: admin.firestore.Timestamp.now(), channel: auto.channel, to,
            })
          } catch (e) {
            console.error(`[automations] send failed contact=${contact.id}:`, e.message)
          }
        }

        if (sent > 0) {
          await Promise.all([
            db.doc(`users/${uid}/automations/${autoDoc.id}`).update({
              runCount: admin.firestore.FieldValue.increment(sent),
              lastRunAt: admin.firestore.Timestamp.now(),
            }),
            db.doc(`users/${uid}`).update({
              messagesUsed: admin.firestore.FieldValue.increment(sent),
            }),
          ])
        }

        console.log(`[automations] auto=${autoDoc.id} sent=${sent}`)
      } catch (e) {
        console.error(`[automations] error processing auto=${autoDoc.id}:`, e.message)
      }
    }
  }
)

// ── 12. createPayfastTopup ────────────────────────────────────────────────────
// One-off PayFast payment that adds extra campaign messages to the user's
// monthly quota (users/{uid}.topupMessages, consumed via effectiveLimit()).
const TOPUP_BUNDLES = {
  t500:  { amount: '200.00', messages: 500,  name: 'Tlhiso 500 message top-up'  },
  t1000: { amount: '380.00', messages: 1000, name: 'Tlhiso 1,000 message top-up' },
  t2500: { amount: '900.00', messages: 2500, name: 'Tlhiso 2,500 message top-up' },
}

exports.createPayfastTopup = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE'],
}, async (req) => {
  requireAuth(req)
  const uid = req.auth.uid
  const bundle = TOPUP_BUNDLES[req.data?.bundleKey]
  if (!bundle) throw new HttpsError('invalid-argument', 'Unknown top-up bundle.')

  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) throw new HttpsError('not-found', 'User profile not found.')
  const user = userSnap.data()

  const merchantId  = process.env.PAYFAST_MERCHANT_ID
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY
  const isSandbox   = merchantId === '10000100'
  const host        = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'

  const nameParts = (user.name || 'User').trim().split(/\s+/)
  const fields = {
    merchant_id:   merchantId,
    merchant_key:  merchantKey,
    return_url:    'https://tlhiso.com',
    cancel_url:    'https://tlhiso.com',
    notify_url:    'https://us-central1-tlhiso.cloudfunctions.net/payfastIPN',
    name_first:    nameParts[0],
    name_last:     nameParts.slice(1).join(' ') || 'User',
    email_address: user.email,
    m_payment_id:  `topup_${uid}_${req.data.bundleKey}_${Date.now()}`,
    amount:        bundle.amount,
    item_name:     bundle.name,
  }
  fields.signature = pfSignature(fields, process.env.PAYFAST_PASSPHRASE)

  const body = Object.entries(fields)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&')

  try {
    const resp = await axios.post(`https://${host}/onsite/process`, body,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    if (!resp.data?.uuid) throw new Error(JSON.stringify(resp.data))
    return { uuid: resp.data.uuid, sandbox: isSandbox }
  } catch (e) {
    console.error('createPayfastTopup error', e.response?.data ?? e.message)
    throw new HttpsError('internal', 'Failed to initiate payment. Please try again.')
  }
})

// ── 13. smsInboundWebhook ─────────────────────────────────────────────────────
// BulkSMS relays inbound replies (MO messages) here. We route each reply to
// the Tlhiso user who most recently messaged that phone number (looked up in
// the per-user messages log) and store it in users/{uid}/inbox. Unroutable
// replies land in the global unrouted_inbox for the super admin.
exports.smsInboundWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
  try {
    const items = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : [])
    for (const item of items) {
      const from = normPhone(item.from || item.sender || item.msisdn)
      const text = item.body ?? item.text ?? item.message ?? ''
      if (!from || !text) continue

      let uid = null
      try {
        const msgSnap = await db.collectionGroup('messages')
          .where('to', '==', from)
          .orderBy('sentAt', 'desc')
          .limit(1)
          .get()
        if (!msgSnap.empty) uid = msgSnap.docs[0].ref.parent.parent?.id ?? null
      } catch (e) {
        console.error('smsInboundWebhook route lookup failed', e.message)
      }

      if (uid) {
        await db.collection(`users/${uid}/inbox`).add({
          from, body: text, channel: 'sms',
          read: false, receivedAt: admin.firestore.Timestamp.now(),
          raw: { id: item.id ?? null, to: item.to ?? null },
        })
      } else {
        await db.collection('unrouted_inbox').add({
          from, body: text, receivedAt: admin.firestore.Timestamp.now(),
        })
      }
    }
  } catch (e) {
    console.error('smsInboundWebhook error', e.message)
  }
  res.status(200).send('OK')
})

// ── 14. Public booking (no auth — uid in the URL is the capability) ──────────
const BOOKING_NAME_FIELD = { medical: 'patient', b2b: 'clientName', property: 'tenantName', retail: 'customer' }

exports.getPublicBookingInfo = onCall({ cors: true }, async (req) => {
  const { uid } = req.data ?? {}
  if (!uid) throw new HttpsError('invalid-argument', 'Missing uid')
  const snap = await db.doc(`users/${uid}`).get()
  const u = snap.data()
  if (!u || u.isActive !== true) throw new HttpsError('not-found', 'Booking page not available.')
  return {
    businessName: u.businessName || u.name || 'Business',
    industry:     u.industry || 'retail',
    logoUrl:      u.businessLogoUrl || u.profilePhotoUrl || null,
  }
})

exports.getPublicBookingSlots = onCall({ cors: true }, async (req) => {
  const { uid, date } = req.data ?? {}
  if (!uid || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new HttpsError('invalid-argument', 'Missing uid or date')
  }
  const snap = await db.collection(`users/${uid}/appointments`).where('date', '==', date).get()
  const taken = snap.docs
    .map(d => d.data())
    .filter(a => (a.status || '').toLowerCase() !== 'cancelled')
    .map(a => a.time)
    .filter(Boolean)
  return { taken }
})

exports.createPublicBooking = onCall({
  cors: true,
  secrets: ['BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET', 'SENDGRID_API_KEY'],
}, async (req) => {
  const { uid, name, phone, email, date, time, service, notes } = req.data ?? {}
  if (!uid || !name?.trim() || !phone?.trim() || !date || !time) {
    throw new HttpsError('invalid-argument', 'Please fill in your name, phone, date and time.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new HttpsError('invalid-argument', 'Invalid date or time.')
  }
  const userSnap = await db.doc(`users/${uid}`).get()
  const owner = userSnap.data()
  if (!owner || owner.isActive !== true) throw new HttpsError('not-found', 'Booking page not available.')

  // Conflict check
  const clash = await db.collection(`users/${uid}/appointments`)
    .where('date', '==', date).where('time', '==', time).get()
  if (clash.docs.some(d => (d.data().status || '').toLowerCase() !== 'cancelled')) {
    throw new HttpsError('already-exists', 'That time slot has just been taken — please pick another.')
  }

  const nameField = BOOKING_NAME_FIELD[owner.industry] ?? 'customer'
  const cleanName = String(name).trim().slice(0, 120)
  const cleanPhone = normPhone(phone)
  const apptRef = await db.collection(`users/${uid}/appointments`).add({
    [nameField]: cleanName,
    name:    cleanName,
    phone:   cleanPhone,
    email:   String(email || '').trim().slice(0, 160) || null,
    date, time,
    service: String(service || '').trim().slice(0, 160) || null,
    reason:  String(service || '').trim().slice(0, 160) || null,
    notes:   String(notes || '').trim().slice(0, 500) || null,
    status:  'pending',
    source:  'public-booking',
    createdAt: admin.firestore.Timestamp.now(),
  })

  const cfg = getConfig()
  const bizName = owner.businessName || owner.name || 'the business'

  // Confirmation SMS to the customer (operational — not counted against quota)
  if (cleanPhone) {
    try {
      await axios.post('https://api.bulksms.com/v1/messages',
        [{ to: cleanPhone, body: `Hi ${cleanName.split(' ')[0]}, your booking request with ${bizName} for ${date} at ${time} has been received. You'll get a confirmation soon.` }],
        { auth: { username: cfg.bulksmsTokenId, password: cfg.bulksmsTokenSecret } })
    } catch (e) { console.error('createPublicBooking sms error', e.message) }
  }

  // Notify the business owner
  if (owner.email) {
    try {
      sgMail.setApiKey(cfg.sendgridKey)
      await sgMail.send({
        to: owner.email,
        from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
        subject: `New booking request — ${cleanName} on ${date} at ${time}`,
        html: `<p><strong>${cleanName}</strong> requested a booking via your public booking page.</p>
          <p>Date: <strong>${date}</strong> at <strong>${time}</strong><br>
          Phone: ${cleanPhone}${email ? `<br>Email: ${email}` : ''}${service ? `<br>Service: ${service}` : ''}${notes ? `<br>Notes: ${notes}` : ''}</p>
          <p><a href="https://tlhiso.com/${owner.industry}/appointments" style="background:#5B8E7D;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Review in Tlhiso</a></p>`,
      })
    } catch (e) { console.error('createPublicBooking owner email error', e.message) }
  }

  return { success: true, id: apptRef.id }
})

// ── 15. Tenant portal (token = base64 { uid, id }) ───────────────────────────
function decodeTenantToken(token) {
  let uid, id
  try {
    const d = JSON.parse(Buffer.from(String(token), 'base64').toString('utf8'))
    uid = d.uid; id = d.id
  } catch { throw new HttpsError('invalid-argument', 'Invalid link.') }
  if (!uid || !id) throw new HttpsError('invalid-argument', 'Invalid link.')
  return { uid, id }
}

exports.getTenantPortal = onCall({ cors: true }, async (req) => {
  const { uid, id } = decodeTenantToken(req.data?.token)
  const tenantSnap = await db.doc(`users/${uid}/tenants/${id}`).get()
  if (!tenantSnap.exists) throw new HttpsError('not-found', 'Tenant not found.')
  const t = tenantSnap.data()

  const ownerSnap = await db.doc(`users/${uid}`).get()
  const owner = ownerSnap.data() ?? {}

  const [invSnap, maintSnap] = await Promise.all([
    db.collection(`users/${uid}/invoices`).where('tenantId', '==', id).get(),
    db.collection(`users/${uid}/maintenance`).where('tenantId', '==', id).get(),
  ])

  const sortByCreated = (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  const invoices = invSnap.docs.map(d => {
    const v = d.data()
    return {
      id: d.id, invoiceNumber: v.invoiceNumber ?? null, total: v.total ?? null,
      status: v.status ?? 'Draft', dueDate: v.dueDate ?? null, issueDate: v.issueDate ?? null,
      createdAt: v.createdAt ?? null,
    }
  }).sort(sortByCreated).slice(0, 12)
  const maintenance = maintSnap.docs.map(d => {
    const v = d.data()
    return {
      id: d.id, title: v.title ?? v.description ?? '', status: v.status ?? 'Open',
      priority: v.priority ?? 'Normal', createdAt: v.createdAt ?? null,
    }
  }).sort(sortByCreated).slice(0, 12)

  return {
    tenant: {
      name: t.name || [t.firstName, t.lastName].filter(Boolean).join(' ') || 'Tenant',
      property: t.property || t.propertyName || null,
      unit: t.unit || null,
      rentAmount: t.rentAmount ?? null,
      leaseStart: t.leaseStart ?? null,
      leaseEnd: t.leaseEnd ?? null,
      status: t.status ?? null,
    },
    agency: { name: owner.businessName || owner.name || 'Your property manager' },
    invoices,
    maintenance,
  }
})

exports.createTenantMaintenance = onCall({
  cors: true,
  secrets: ['SENDGRID_API_KEY'],
}, async (req) => {
  const { uid, id } = decodeTenantToken(req.data?.token)
  const { title, description, priority } = req.data ?? {}
  if (!title?.trim()) throw new HttpsError('invalid-argument', 'Please describe the issue.')

  const tenantSnap = await db.doc(`users/${uid}/tenants/${id}`).get()
  if (!tenantSnap.exists) throw new HttpsError('not-found', 'Tenant not found.')
  const t = tenantSnap.data()
  const tenantName = t.name || [t.firstName, t.lastName].filter(Boolean).join(' ') || 'Tenant'

  await db.collection(`users/${uid}/maintenance`).add({
    title:       String(title).trim().slice(0, 160),
    description: String(description || '').trim().slice(0, 1000),
    priority:    ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium',
    status:      'Open',
    tenant:      tenantName,
    tenantId:    id,
    property:    t.property || t.propertyName || null,
    source:      'tenant-portal',
    createdAt:   admin.firestore.Timestamp.now(),
  })

  // Notify the property manager
  try {
    const ownerSnap = await db.doc(`users/${uid}`).get()
    const owner = ownerSnap.data()
    if (owner?.email) {
      const cfg = getConfig()
      sgMail.setApiKey(cfg.sendgridKey)
      await sgMail.send({
        to: owner.email,
        from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
        subject: `New maintenance request from ${tenantName}`,
        html: `<p><strong>${tenantName}</strong> logged a maintenance request via the tenant portal.</p>
          <p><strong>${String(title).trim()}</strong>${description ? `<br>${String(description).trim()}` : ''}</p>
          <p><a href="https://tlhiso.com/property/maintenance" style="background:#5B8E7D;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">View in Tlhiso</a></p>`,
      })
    }
  } catch (e) { console.error('createTenantMaintenance notify error', e.message) }

  return { success: true }
})

// ── 16. processBilling (daily, 06:00 UTC ≈ 08:00 SAST) ───────────────────────
// a) Recurring invoices: templates with recurring=true and nextRunAt due get a
//    fresh invoice generated (and optionally emailed to the client).
// b) Monthly statements: on the 1st, users with autoStatements=true get a
//    summary of open invoices emailed to each client that owes.
// c) PayFast subscription renewals are handled automatically by PayFast; IPN updates account status.
exports.processBilling = onSchedule(
  {
    schedule: '0 6 * * *',
    secrets: ['SENDGRID_API_KEY'],
  },
  async () => {
    const now = admin.firestore.Timestamp.now()
    const cfg = getConfig()
    const todayStr = new Date().toISOString().slice(0, 10)
    const fmtR = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`

    // ── a) Recurring invoices ────────────────────────────────────────────────
    const recSnap = await db.collectionGroup('invoices')
      .where('recurring', '==', true)
      .where('nextRunAt', '<=', now)
      .get()

    for (const tplDoc of recSnap.docs) {
      const tpl = tplDoc.data()
      const uid = tplDoc.ref.parent.parent?.id
      if (!uid) continue
      // Advance first to avoid double-generation
      await tplDoc.ref.update({
        nextRunAt: computeNextRun({ freq: 'monthly', dayOfMonth: tpl.recurringDay ?? 1, time: '08:00' }),
        lastRunAt: now,
      })
      try {
        const countSnap = await db.collection(`users/${uid}/invoices`).count().get()
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(3, '0')}`
        const due = new Date(); due.setDate(due.getDate() + (tpl.dueDays ?? 14))
        const newInv = {
          invoiceNumber,
          client:    tpl.client ?? '',
          clientId:  tpl.clientId ?? null,
          tenantId:  tpl.tenantId ?? null,
          items:     tpl.items ?? [],
          total:     tpl.total ?? 0,
          vat:       tpl.vat ?? 0,
          notes:     tpl.notes ?? '',
          issueDate: todayStr,
          dueDate:   due.toISOString().slice(0, 10),
          status:    'Draft',
          fromRecurringId: tplDoc.id,
          createdAt: now,
        }
        const newRef = await db.collection(`users/${uid}/invoices`).add(newInv)

        // Optional auto-email to the client
        if (tpl.autoEmail && tpl.clientId) {
          const clientSnap = await db.doc(`users/${uid}/customers/${tpl.clientId}`).get()
          const clientEmail = clientSnap.data()?.email
          const ownerSnap = await db.doc(`users/${uid}`).get()
          const bizName = ownerSnap.data()?.businessName || ownerSnap.data()?.name || 'Tlhiso'
          if (clientEmail) {
            const rows = (newInv.items || []).map(i =>
              `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.desc || ''}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${fmtR(Number(i.qty || 1) * Number(i.price ?? i.unitPrice ?? 0))}</td></tr>`).join('')
            sgMail.setApiKey(cfg.sendgridKey)
            await sgMail.send({
              to: clientEmail,
              from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
              subject: `Invoice ${invoiceNumber} from ${bizName}`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
                <h2 style="color:#5B8E7D">Invoice ${invoiceNumber}</h2>
                <p>Hi ${newInv.client || 'there'},</p>
                <p>Please find your monthly invoice below, due <strong>${newInv.dueDate}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}</table>
                <p style="text-align:right;font-size:15px;margin-top:12px">Total (incl. VAT): <strong style="color:#5B8E7D">${fmtR(newInv.total)}</strong></p>
                <p style="font-size:12px;color:#94a3b8">Sent via Tlhiso</p></div>`,
            })
            await newRef.update({ status: 'Sent' })
          }
        }
        console.log(`[billing] recurring invoice ${invoiceNumber} generated for uid=${uid}`)
      } catch (e) {
        console.error(`[billing] recurring invoice error tpl=${tplDoc.id}:`, e.message)
      }
    }

    // ── b) Monthly statements (1st of the month) ─────────────────────────────
    if (new Date().getUTCDate() !== 1) return
    const usersSnap = await db.collection('users').where('autoStatements', '==', true).get()
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id
      const owner = userDoc.data()
      try {
        const invSnap = await db.collection(`users/${uid}/invoices`).get()
        const open = invSnap.docs.map(d => d.data())
          .filter(i => i.status === 'Sent' || i.status === 'Overdue')
        if (open.length === 0) continue

        // Group open invoices by client
        const byClient = {}
        open.forEach(i => {
          const key = i.clientId || i.client || 'unknown'
          ;(byClient[key] = byClient[key] || []).push(i)
        })

        const bizName = owner.businessName || owner.name || 'Tlhiso'
        for (const [clientKey, invs] of Object.entries(byClient)) {
          let clientEmail = null, clientName = invs[0].client || 'Client'
          if (invs[0].clientId) {
            const cSnap = await db.doc(`users/${uid}/customers/${invs[0].clientId}`).get()
            clientEmail = cSnap.data()?.email ?? null
          }
          if (!clientEmail) continue
          const totalDue = invs.reduce((s, i) => s + Number(i.total ?? 0), 0)
          const rows = invs.map(i =>
            `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.invoiceNumber || '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.dueDate || '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${fmtR(i.total)}</td></tr>`).join('')
          sgMail.setApiKey(cfg.sendgridKey)
          await sgMail.send({
            to: clientEmail,
            from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
            subject: `Statement from ${bizName} — ${fmtR(totalDue)} outstanding`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
              <h2 style="color:#5B8E7D">Monthly Statement</h2>
              <p>Hi ${clientName},</p>
              <p>Here is a summary of your open invoices with ${bizName}:</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <tr style="background:#f8fafc"><th style="padding:6px 10px;text-align:left">Invoice</th><th style="padding:6px 10px;text-align:left">Due</th><th style="padding:6px 10px;text-align:right">Amount</th></tr>
                ${rows}</table>
              <p style="text-align:right;font-size:15px;margin-top:12px">Total outstanding: <strong style="color:#5B8E7D">${fmtR(totalDue)}</strong></p>
              <p style="font-size:12px;color:#94a3b8">Sent via Tlhiso</p></div>`,
          })
        }
        console.log(`[billing] statements sent for uid=${uid} (${Object.keys(byClient).length} clients)`)
      } catch (e) {
        console.error(`[billing] statements error uid=${uid}:`, e.message)
      }
    }
  }
)

// ── getProviderStats ──────────────────────────────────────────────────────────
// Super-admin only. Returns BulkSMS credit balance + current-month SendGrid stats.
exports.getProviderStats = onCall({
  secrets: ['SENDGRID_API_KEY', 'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET'],
}, async (req) => {
  requireSuperAdmin(req)
  const cfg = getConfig()

  const now   = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const end   = now.toISOString().slice(0, 10)

  const [bulkRes, sgRes] = await Promise.allSettled([
    axios.get('https://api.bulksms.com/v1/credits/balance', {
      auth: { username: cfg.bulksmsTokenId, password: cfg.bulksmsTokenSecret },
    }),
    axios.get(`https://api.sendgrid.com/v3/stats?start_date=${start}&end_date=${end}&aggregated_by=month`, {
      headers: { Authorization: `Bearer ${cfg.sendgridKey}` },
    }),
  ])

  const bulksms = bulkRes.status === 'fulfilled'
    ? { balance: bulkRes.value.data.balance, currency: bulkRes.value.data.currency ?? 'ZAR' }
    : { error: bulkRes.reason?.response?.data?.message ?? bulkRes.reason?.message }

  let sendgrid = { error: 'Unavailable' }
  if (sgRes.status === 'fulfilled') {
    const row = sgRes.value.data?.[0]
    const m   = row?.stats?.[0]?.metrics ?? {}
    sendgrid = {
      requests:  m.requests  ?? 0,
      delivered: m.delivered ?? 0,
      bounces:   m.bounces   ?? 0,
      opens:     m.opens     ?? 0,
      clicks:    m.clicks    ?? 0,
      period:    start,
    }
  } else {
    sendgrid = { error: sgRes.reason?.response?.data?.errors?.[0]?.message ?? sgRes.reason?.message }
  }

  return { bulksms, sendgrid }
})

// ISO 8601 week key, e.g. "2026-W25" — Monday is the start of the week
function weekKey() {
  const d = new Date()
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const y = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(y, 0, 1))
  const w = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

// ── suggestCampaign (Gemini API) ─────────────────────────────────────────────
// Generates 3 SA-tailored campaign strategy suggestions for the caller's industry.
// Results are cached in /users/{uid}/aiSuggestions/latest for one week.
// Get a free key at aistudio.google.com, then: firebase functions:secrets:set GEMINI_API_KEY
exports.suggestCampaign = onCall({ timeoutSeconds: 60, secrets: ['GEMINI_API_KEY'] }, async (req) => {
  requireAuth(req)
  const uid = req.auth.uid
  const { industry, contactCount, tags, recentCampaigns } = req.data ?? {}

  // Return cached suggestions if already generated this week
  const wk = weekKey()
  const cacheRef = db.doc(`users/${uid}/aiSuggestions/latest`)
  const cacheSnap = await cacheRef.get()
  if (cacheSnap.exists && cacheSnap.data()?.weekKey === wk) {
    const cached = cacheSnap.data()?.suggestions
    if (Array.isArray(cached) && cached.length > 0) {
      return { success: true, suggestions: cached, fromCache: true }
    }
  }

  const INDUSTRY_LABELS = {
    medical:  'Medical & Health (doctors, clinics, therapists)',
    b2b:      'B2B Professional Services',
    property: 'Property Management',
    retail:   'Retail & Consumer Business',
  }
  const CONTACT_LABELS = {
    medical: 'patient', b2b: 'client', property: 'tenant', retail: 'customer',
  }

  const contactLabel  = CONTACT_LABELS[industry] ?? 'contact'
  const industryLabel = INDUSTRY_LABELS[industry] ?? String(industry || 'business')
  const safeTags      = Array.isArray(tags) ? tags.slice(0, 10) : []
  const safeRecent    = Array.isArray(recentCampaigns) ? recentCampaigns.slice(0, 5) : []
  const count         = Number(contactCount) || 0

  const prompt = `You are a marketing strategist for South African SMEs using the Tlhiso platform.

Business context:
- Industry: ${industryLabel}
- Contact base: ${count} ${contactLabel}${count !== 1 ? 's' : ''}${safeTags.length ? `\n- Contact tags available: ${safeTags.join(', ')}` : ''}${safeRecent.length ? `\n- Recent campaigns (do not repeat these): ${safeRecent.join(', ')}` : ''}

Generate exactly 3 distinct, practical campaign suggestions for this South African business. Requirements:
- Reference SA pay days (25th or last working day = high purchase intent) where relevant
- Use South African English
- SMS body must be 160 characters or fewer (total, including any {name} merge tag)
- Suggest a mix: at least one SMS and one email campaign across the 3
- Do not suggest anything that violates POPIA (no buying contact lists, always reference opt-in)

Also include a "businessTip": one sharp, direct sentence (max 20 words) — the single most important action this owner should take THIS week to grow revenue or retain ${contactLabel}s. Make it concrete and SA-specific.

Return ONLY valid JSON — no markdown, no code fences, no explanation:
{
  "businessTip": "One punchy sentence of actionable advice for this week.",
  "suggestions": [
    {
      "title": "Campaign name (max 6 words)",
      "description": "What this campaign does and why it works for SA ${contactLabel}s (1–2 sentences)",
      "timing": "Best send time e.g. 'Tuesday at 10:00' or '25th of the month at 09:00 (pay day)'",
      "segment": "Who to target e.g. 'All ${contactLabel}s' or a specific tag or filter",
      "channel": "sms",
      "smsBody": "Hi {name}, [message] — 160 chars max including {name}",
      "emailSubject": "Subject line for the email version",
      "emailBody": "Hi {name},\\n\\n[2–3 paragraph body]\\n\\nKind regards,\\n[Your Business]"
    }
  ]
}`

  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) return { success: false, error: 'AI not configured. Contact support.' }

  // Try models in preference order — stops at the first one that succeeds
  const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite']
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
  }

  let aiResp = null
  let lastErr = null
  for (const model of MODELS) {
    try {
      aiResp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 50000 }
      )
      break
    } catch (e) {
      lastErr = e
      console.warn(`suggestCampaign: model ${model} failed (${e.response?.status}) — trying next`)
    }
  }

  if (!aiResp) {
    console.error('suggestCampaign: all models failed for uid=', uid)
    return { success: false, error: 'Could not reach AI. Please try again later.' }
  }

  try {
    const raw     = aiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('suggestCampaign: JSON parse failed —', raw.slice(0, 300))
      return { success: false, error: 'AI returned an unexpected format. Please try again.' }
    }

    const suggestions  = Array.isArray(parsed?.suggestions) ? parsed.suggestions.slice(0, 3) : []
    const businessTip  = typeof parsed?.businessTip === 'string' ? parsed.businessTip.trim() : ''

    if (suggestions.length > 0) {
      await cacheRef.set({
        suggestions,
        businessTip,
        weekKey: wk,
        industry,
        generatedAt: admin.firestore.Timestamp.now(),
      }).catch(e => console.warn('suggestCampaign: Firestore cache write failed —', e.message))
    }

    return { success: true, suggestions, businessTip }
  } catch (e) {
    console.error('suggestCampaign error', e.response?.status, e.response?.data ?? e.message)
    return { success: false, error: 'Could not generate suggestions. Please try again.' }
  }
})

// ── generateWeeklySuggestions ─────────────────────────────────────────────────
// Runs every Monday at 07:00 SAST (05:00 UTC).
// Reads each active user's real data (contacts, campaigns, appointments),
// generates data-informed AI campaign suggestions, and stores them in Firestore
// so they're ready instantly when the user opens the Campaigns module.
exports.generateWeeklySuggestions = onSchedule(
  { schedule: '0 5 * * 1', timeoutSeconds: 540, secrets: ['GEMINI_API_KEY'] },
  async () => {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim()
    if (!apiKey) { console.error('[weekly AI] GEMINI_API_KEY not set'); return }

    const wk = weekKey()
    const INDUSTRY_LABELS = {
      medical:  'Medical & Health (doctors, clinics, therapists)',
      b2b:      'B2B Professional Services',
      property: 'Property Management',
      retail:   'Retail & Consumer Business',
    }
    const CONTACT_LABELS  = { medical: 'patient', b2b: 'client', property: 'tenant', retail: 'customer' }
    const CONTACT_COLS    = { medical: 'patients', b2b: 'customers', property: 'tenants', retail: 'customers' }
    const MODELS          = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash-lite']

    const usersSnap = await db.collection('users').where('isActive', '==', true).get()
    console.log(`[weekly AI] week=${wk}, processing ${usersSnap.size} active users`)

    for (const userDoc of usersSnap.docs) {
      const uid      = userDoc.id
      const u        = userDoc.data()
      const industry = u.industry
      if (!industry || !INDUSTRY_LABELS[industry]) continue

      // Skip if already generated this week (manual or prior run)
      const cacheRef  = db.doc(`users/${uid}/aiSuggestions/latest`)
      const cacheSnap = await cacheRef.get()
      if (cacheSnap.exists && cacheSnap.data()?.weekKey === wk) {
        console.log(`[weekly AI] uid=${uid} already has week=${wk} suggestions — skipping`)
        continue
      }

      try {
        const contactCol = CONTACT_COLS[industry]
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

        const [contactSnap, campaignSnap, apptSnap] = await Promise.all([
          db.collection(`users/${uid}/${contactCol}`).limit(500).get(),
          db.collection(`users/${uid}/campaigns`).orderBy('createdAt', 'desc').limit(8).get(),
          db.collection(`users/${uid}/appointments`)
            .where('date', '>=', thirtyDaysAgo).limit(200).get(),
        ])

        // Summarise contact tags
        const tagCounts = {}
        contactSnap.docs.forEach(d =>
          (d.data().tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 })
        )
        const topTags = Object.entries(tagCounts)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([t, n]) => `${t} (${n})`)

        // Summarise campaign performance
        const camps     = campaignSnap.docs.map(d => d.data())
        const sentCamps = camps.filter(c => c.sentCount > 0)
        const bestCamp  = [...sentCamps].sort((a, b) => (b.openCount || 0) - (a.openCount || 0))[0]
        const avgOpen   = sentCamps.length
          ? Math.round(sentCamps.reduce((s, c) => s + ((c.openCount || 0) / Math.max(c.sentCount, 1)) * 100, 0) / sentCamps.length)
          : 0
        const recentNames = sentCamps.slice(0, 4).map(c => c.campaignName || c.subject || '').filter(Boolean)

        const contactLabel  = CONTACT_LABELS[industry]
        const industryLabel = INDUSTRY_LABELS[industry]

        const prompt = `You are a growth strategist for South African SMEs on the Tlhiso platform.

Analyse this ${industryLabel} business's real performance data and generate 3 targeted campaign strategies for the coming week.

Business data:
- Contact base: ${contactSnap.size} ${contactLabel}s
- Top contact segments: ${topTags.join(', ') || 'no tags set yet'}
- Campaigns sent (last 8 weeks): ${sentCamps.length}, avg open rate ${avgOpen}%
${bestCamp ? `- Best performing campaign: "${bestCamp.campaignName || bestCamp.subject || 'Untitled'}" (${bestCamp.openCount || 0} opens out of ${bestCamp.sentCount} sent)` : '- No campaigns sent yet — suggest first-time campaigns'}
${recentNames.length ? `- Recent campaigns (do not repeat): ${recentNames.join(', ')}` : ''}
- Appointments this month: ${apptSnap.size}

Strategic priorities:
1. Replicate what's working — if there's a top-performing campaign, build on that angle
2. Re-engage ${contactLabel}s who haven't been contacted recently
3. Capitalise on the SA pay-day cycle (25th or last working day of month = high purchase intent)
4. POPIA-compliant messaging only — reference opted-in contacts, no bought lists

Requirements:
- South African English
- SMS body must be 160 characters or fewer (including any {name} merge tag)
- Mix channels: at least one SMS and one email across the 3 suggestions

Also include a "businessTip": one sharp, direct sentence (max 20 words) — the single most important action this owner should take THIS week to grow revenue or retain ${contactLabel}s. Base it on the data above. Make it concrete and SA-specific.

Return ONLY valid JSON — no markdown, no code fences, no explanation:
{
  "businessTip": "One punchy sentence of actionable advice for this week.",
  "suggestions": [
    {
      "title": "Campaign name (max 6 words)",
      "description": "Why this will grow the business this week, referencing the data above (1–2 sentences)",
      "timing": "Best send time e.g. 'Monday at 09:00' or '25th of the month at 09:00 (pay day)'",
      "segment": "Who to target e.g. 'All ${contactLabel}s' or a specific tag or filter",
      "channel": "sms or email",
      "smsBody": "Hi {name}, [message] — 160 chars max",
      "emailSubject": "Subject line",
      "emailBody": "Hi {name},\\n\\n[2–3 paragraph body]\\n\\nKind regards,\\n[Your Business]"
    }
  ]
}`

        let aiResp = null
        for (const model of MODELS) {
          try {
            aiResp = await axios.post(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
              },
              { headers: { 'Content-Type': 'application/json' }, timeout: 50000 }
            )
            break
          } catch (e) {
            console.warn(`[weekly AI] model ${model} failed (${e.response?.status}) for uid=${uid}`)
          }
        }

        if (!aiResp) { console.error(`[weekly AI] all models failed for uid=${uid}`); continue }

        const raw     = aiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
        let suggestions, businessTip
        try {
          const parsed = JSON.parse(cleaned)
          suggestions  = parsed?.suggestions?.slice(0, 3) || []
          businessTip  = typeof parsed?.businessTip === 'string' ? parsed.businessTip.trim() : ''
        } catch {
          console.error(`[weekly AI] JSON parse failed for uid=${uid}`)
          continue
        }

        await cacheRef.set({
          suggestions,
          businessTip,
          weekKey: wk,
          industry,
          generatedAt: admin.firestore.Timestamp.now(),
          dataSnapshot: {
            contactCount:         contactSnap.size,
            campaignsSent:        sentCamps.length,
            avgOpenRate:          avgOpen,
            appointmentsThisMonth: apptSnap.size,
          },
        })
        console.log(`[weekly AI] saved ${suggestions.length} suggestions for uid=${uid}`)

        // Brief pause between users to stay within Gemini free-tier RPM limits
        await new Promise(r => setTimeout(r, 2000))
      } catch (e) {
        console.error(`[weekly AI] error for uid=${uid}:`, e.message)
      }
    }

    console.log('[weekly AI] done')
  }
)

// ── superAdminChat (Vertex AI Agent) ─────────────────────────────────────────
// Conversational AI agent for the super admin. Queries live Firestore data
// using Gemini function-calling on Vertex AI (uses service account ADC, no key).
const { VertexAI } = require('@google-cloud/vertexai')

const VERTEX_TOOLS = [{
  functionDeclarations: [
    {
      name: 'get_platform_stats',
      description: 'Get overall platform KPIs: total users, active/pending counts, paid subscribers, estimated MRR, breakdown by industry and subscription plan.',
      parameters: { type: 'OBJECT', properties: {} },
    },
    {
      name: 'get_user_list',
      description: 'List users with optional filters. Returns name, email, industry, plan, status and registration date.',
      parameters: {
        type: 'OBJECT',
        properties: {
          industry: { type: 'STRING', description: 'Filter by industry: b2b, medical, property, or retail' },
          status:   { type: 'STRING', description: 'Filter by status: active or pending' },
          plan:     { type: 'STRING', description: 'Filter by plan: starter, business, or enterprise' },
          paid:     { type: 'BOOLEAN', description: 'true = paid only, false = unpaid only, omit = all' },
          limit:    { type: 'INTEGER', description: 'Max results to return (default 20, max 50)' },
        },
      },
    },
    {
      name: 'get_user_detail',
      description: 'Get full profile and subscription details for a specific user by their email address.',
      parameters: {
        type: 'OBJECT',
        properties: { email: { type: 'STRING', description: 'Email address of the user' } },
        required: ['email'],
      },
    },
    {
      name: 'get_campaign_stats',
      description: 'Get campaign statistics — total campaigns sent platform-wide or for a specific user, broken down by type (SMS, email, WhatsApp).',
      parameters: {
        type: 'OBJECT',
        properties: { userId: { type: 'STRING', description: 'Optional user ID to scope stats to one user; omit for platform-wide totals' } },
      },
    },
    {
      name: 'get_appointment_stats',
      description: 'Get appointment statistics platform-wide or for a specific user, broken down by status (confirmed, cancelled, pending).',
      parameters: {
        type: 'OBJECT',
        properties: { userId: { type: 'STRING', description: 'Optional user ID; omit for platform-wide totals' } },
      },
    },
    {
      name: 'get_message_usage',
      description: 'Get messaging usage — total SMS and email messages sent platform-wide or for a specific user.',
      parameters: {
        type: 'OBJECT',
        properties: { userId: { type: 'STRING', description: 'Optional user ID; omit for platform-wide totals' } },
      },
    },
    {
      name: 'get_revenue_trend',
      description: 'Get monthly revenue trend showing new paid users and MRR added each month for the last N months.',
      parameters: {
        type: 'OBJECT',
        properties: { months: { type: 'INTEGER', description: 'Number of months to look back (default 6)' } },
      },
    },
    {
      name: 'get_inactive_users',
      description: 'Get active users who have not paid and registered more than N days ago — useful for identifying churn risk or unconverted trials.',
      parameters: {
        type: 'OBJECT',
        properties: { days: { type: 'INTEGER', description: 'Days since registration threshold (default 30)' } },
      },
    },
    {
      name: 'get_recent_signups',
      description: 'Get users who registered within the last N days.',
      parameters: {
        type: 'OBJECT',
        properties: { days: { type: 'INTEGER', description: 'Number of days to look back (default 7)' } },
      },
    },
    {
      name: 'activate_user',
      description: 'Activate a pending user account so they can access their dashboard.',
      parameters: {
        type: 'OBJECT',
        properties: { email: { type: 'STRING', description: 'Email of the user to activate' } },
        required: ['email'],
      },
    },
    {
      name: 'suspend_user',
      description: 'Suspend an active user account, blocking dashboard access.',
      parameters: {
        type: 'OBJECT',
        properties: { email: { type: 'STRING', description: 'Email of the user to suspend' } },
        required: ['email'],
      },
    },
    {
      name: 'change_user_plan',
      description: "Change a user's subscription plan.",
      parameters: {
        type: 'OBJECT',
        properties: {
          email: { type: 'STRING', description: 'Email of the user' },
          plan:  { type: 'STRING', description: 'New plan key: starter, business, or enterprise' },
        },
        required: ['email', 'plan'],
      },
    },
    {
      name: 'send_email_to_user',
      description: 'Send an email directly to a platform user.',
      parameters: {
        type: 'OBJECT',
        properties: {
          email:   { type: 'STRING', description: 'Recipient email address' },
          subject: { type: 'STRING', description: 'Email subject line' },
          message: { type: 'STRING', description: 'Plain-text message body (will be wrapped in HTML)' },
        },
        required: ['email', 'subject', 'message'],
      },
    },
  ],
}]

function buildAgentTools(users) {
  const fdb = admin.firestore()
  function planPrice(plan) { return parseFloat(PLAN_PRICES[plan]?.amount || 0) }
  function findUser(email) { return users.find(u => u.email?.toLowerCase() === email?.toLowerCase()) }

  return {
    // ── Read: user data from in-memory users array ──────────────────────────
    get_platform_stats: async () => {
      const active = users.filter(u => u.isActive).length
      const paid   = users.filter(u => u.isPaid).length
      const mrr    = users.filter(u => u.isPaid).reduce((s, u) => s + planPrice(u.plan), 0)
      const byIndustry = {}; const byPlan = {}
      users.forEach(u => {
        byIndustry[u.industry || 'unknown'] = (byIndustry[u.industry || 'unknown'] || 0) + 1
        byPlan[u.plan || 'unknown']         = (byPlan[u.plan || 'unknown'] || 0) + 1
      })
      return { total: users.length, active, pending: users.length - active, paid, unpaid: users.length - paid, estimatedMRR_ZAR: mrr, byIndustry, byPlan }
    },
    get_user_list: async ({ industry, status, plan, paid, limit = 20 }) => {
      let list = users
      if (industry)           list = list.filter(u => u.industry === industry)
      if (status === 'active')  list = list.filter(u => u.isActive)
      if (status === 'pending') list = list.filter(u => !u.isActive)
      if (plan)               list = list.filter(u => u.plan === plan)
      if (paid === true)      list = list.filter(u => u.isPaid)
      if (paid === false)     list = list.filter(u => !u.isPaid)
      return list.slice(0, Math.min(limit, 50)).map(u => ({
        name: u.name || u.businessName || u.email,
        email: u.email, industry: u.industry, plan: u.plan,
        isActive: u.isActive, isPaid: u.isPaid,
        registered: u.createdAt?.toDate?.()?.toISOString?.() || null,
      }))
    },
    get_user_detail: async ({ email }) => {
      const u = findUser(email)
      if (!u) return { error: `No user found with email: ${email}` }
      return {
        name: u.name, businessName: u.businessName, email: u.email, phone: u.phone,
        industry: u.industry, profession: u.profession, plan: u.plan,
        planPrice_ZAR: planPrice(u.plan) || null,
        isActive: u.isActive, isPaid: u.isPaid,
        status: u.status || (u.isActive ? 'active' : 'pending'),
        address: u.address, vatNumber: u.vatNumber, popiaConsent: u.popiaConsent,
        registered: u.createdAt?.toDate?.()?.toISOString?.() || null,
        paidAt: u.paidAt || null,
      }
    },
    get_revenue_trend: async ({ months = 6 }) => {
      const now = new Date()
      const buckets = {}
      for (let i = months - 1; i >= 0; i--) {
        const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        buckets[key] = { month: key, newPaidUsers: 0, mrrAdded_ZAR: 0 }
      }
      users.filter(u => u.isPaid && u.paidAt).forEach(u => {
        const d   = new Date(u.paidAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (buckets[key]) { buckets[key].newPaidUsers++; buckets[key].mrrAdded_ZAR += planPrice(u.plan) }
      })
      return Object.values(buckets)
    },
    get_inactive_users: async ({ days = 30 }) => {
      const cutoff = new Date(Date.now() - days * 86400000)
      return users
        .filter(u => {
          const created = u.createdAt?.toDate?.() || new Date(u.createdAt || 0)
          return u.isActive && !u.isPaid && created < cutoff
        })
        .map(u => ({
          name: u.name || u.businessName || u.email, email: u.email,
          industry: u.industry, plan: u.plan,
          daysSinceRegistration: Math.floor((Date.now() - (u.createdAt?.toDate?.() || new Date()).getTime()) / 86400000),
        }))
    },
    get_recent_signups: async ({ days = 7 }) => {
      const cutoff = new Date(Date.now() - days * 86400000)
      return users
        .filter(u => (u.createdAt?.toDate?.() || new Date(0)) >= cutoff)
        .map(u => ({
          name: u.name || u.businessName || u.email, email: u.email,
          industry: u.industry, plan: u.plan, isActive: u.isActive, isPaid: u.isPaid,
          registered: u.createdAt?.toDate?.()?.toISOString?.() || null,
        }))
    },

    // ── Read: Firestore subcollection counts ────────────────────────────────
    get_campaign_stats: async ({ userId } = {}) => {
      if (userId) {
        const base = fdb.collection(`users/${userId}/campaigns`)
        const [total, sms, email, wa] = await Promise.all([
          base.count().get(),
          base.where('type', '==', 'sms').count().get(),
          base.where('type', '==', 'email').count().get(),
          base.where('type', '==', 'whatsapp').count().get(),
        ])
        return { userId, total: total.data().count, bySMS: sms.data().count, byEmail: email.data().count, byWhatsApp: wa.data().count }
      }
      const base = fdb.collectionGroup('campaigns')
      const [total, sms, email, wa] = await Promise.all([
        base.count().get(),
        base.where('type', '==', 'sms').count().get(),
        base.where('type', '==', 'email').count().get(),
        base.where('type', '==', 'whatsapp').count().get(),
      ])
      return { platformWide: true, total: total.data().count, bySMS: sms.data().count, byEmail: email.data().count, byWhatsApp: wa.data().count }
    },
    get_appointment_stats: async ({ userId } = {}) => {
      const base = userId
        ? fdb.collection(`users/${userId}/appointments`)
        : fdb.collectionGroup('appointments')
      const [total, confirmed, cancelled] = await Promise.all([
        base.count().get(),
        base.where('status', '==', 'Confirmed').count().get(),
        base.where('status', '==', 'Cancelled').count().get(),
      ])
      return {
        ...(userId ? { userId } : { platformWide: true }),
        total: total.data().count,
        confirmed: confirmed.data().count,
        cancelled: cancelled.data().count,
        pending: total.data().count - confirmed.data().count - cancelled.data().count,
      }
    },
    get_message_usage: async ({ userId } = {}) => {
      const base = userId
        ? fdb.collection(`users/${userId}/messages`)
        : fdb.collectionGroup('messages')
      const [total, sms, email] = await Promise.all([
        base.count().get(),
        base.where('type', '==', 'sms').count().get(),
        base.where('type', '==', 'email').count().get(),
      ])
      return {
        ...(userId ? { userId } : { platformWide: true }),
        total: total.data().count, sms: sms.data().count, email: email.data().count,
      }
    },

    // ── Write: user account actions ─────────────────────────────────────────
    activate_user: async ({ email }) => {
      const u = findUser(email)
      if (!u) return { error: `No user found with email: ${email}` }
      await fdb.doc(`users/${u.id}`).update({ isActive: true, status: 'active' })
      return { success: true, message: `${email} has been activated.` }
    },
    suspend_user: async ({ email }) => {
      const u = findUser(email)
      if (!u) return { error: `No user found with email: ${email}` }
      await fdb.doc(`users/${u.id}`).update({ isActive: false, status: 'suspended' })
      return { success: true, message: `${email} has been suspended.` }
    },
    change_user_plan: async ({ email, plan }) => {
      if (!PLAN_PRICES[plan]) return { error: `Invalid plan: ${plan}. Valid options: starter, business, enterprise.` }
      const u = findUser(email)
      if (!u) return { error: `No user found with email: ${email}` }
      await fdb.doc(`users/${u.id}`).update({ plan })
      return { success: true, message: `${email} plan changed to ${plan} (R${PLAN_PRICES[plan].amount}/mo).` }
    },
    send_email_to_user: async ({ email, subject, message }) => {
      await sgMail.send({
        to: email,
        from: { name: 'Tlhiso', email: 'hello@tlhiso.com' },
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      })
      return { success: true, message: `Email sent to ${email}.` }
    },
  }
}

exports.superAdminChat = onCall({ timeoutSeconds: 90, secrets: ['SENDGRID_API_KEY', 'GEMINI_API_KEY'] }, async (req) => {
  requireSuperAdmin(req)

  const { message, history = [] } = req.data
  if (!message || typeof message !== 'string') {
    throw new HttpsError('invalid-argument', 'message is required')
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const snap  = await admin.firestore().collection('users').get()
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  const agentTools = buildAgentTools(users)
  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const systemText = `You are Tlhiso Intelligence — a direct marketing and business growth advisor built into the Tlhiso platform. You serve the super admin who manages a portfolio of South African SME clients across B2B, medical, property, and retail industries.

YOUR PRIMARY MISSION: Help every business on the platform grow their client base and revenue through direct marketing. Always think about: who can they reach, what should they say, and when should they send it.

HOW TO APPROACH EVERY CONVERSATION:
- Lead with growth opportunities, not just data. When you see numbers, tell the admin what action to take next.
- Identify which users are under-utilising their message quota — they're leaving growth on the table.
- Suggest specific campaigns: SMS for urgency, email for detail, WhatsApp for personal touch.
- Think in terms of the customer journey: acquisition → retention → re-engagement.
- If a user has contacts but hasn't sent campaigns recently, flag them as a growth opportunity.
- Recommend campaign ideas tailored to the industry (e.g. appointment reminders for medical, rent due notices for property, weekly deals for retail, invoice follow-ups for B2B).

DIRECT MARKETING PRINCIPLES YOU APPLY:
- Businesses grow by consistently communicating with their existing contacts AND acquiring new ones.
- Personalisation increases conversion — use the customer's name and relevant details.
- A follow-up message to non-responders can double campaign results.
- Seasonal and event-based campaigns outperform generic ones.

TOOLS: Always call a tool before stating figures. Use data to back every recommendation.
ACTIONS: You can activate/suspend users, change plans, and send emails directly. Confirm after every action.
TONE: Confident, direct, growth-minded. South African English. Currency ZAR (R). Today is ${today}.`

  // gemini-1.5-flash has 15 RPM free tier (3x more than 2.5-flash); gemini-1.5-flash-8b is a lighter fallback
  const MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b']

  async function callGemini(contents) {
    for (const model of MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemText }] },
              contents,
              tools: VERTEX_TOOLS,
              generationConfig: { temperature: 0.7 },
            }),
          }
        )
        if (!res.ok) {
          const e = await res.json()
          console.error(`[superAdminChat] ${model}:`, e?.error?.message)
          continue
        }
        const data = await res.json()
        if (data.candidates?.[0]) return data
      } catch (e) { console.error(`[superAdminChat] ${model}:`, e.message) }
    }
    throw new Error('All Gemini models failed')
  }

  // Build initial contents from persisted history + new user message
  let contents = [...history, { role: 'user', parts: [{ text: message }] }]

  let data      = await callGemini(contents)
  let candidate = data.candidates[0]
  contents      = [...contents, { role: 'model', parts: candidate.content.parts }]

  // Agentic loop: execute tool calls until model returns a plain text response
  let loopCount = 0
  while (candidate.content.parts.some(p => p.functionCall) && loopCount < 8) {
    loopCount++
    const fnResponses = await Promise.all(
      candidate.content.parts.filter(p => p.functionCall).map(async p => {
        const fn     = agentTools[p.functionCall.name]
        const result = fn ? await fn(p.functionCall.args || {}) : { error: `Unknown tool: ${p.functionCall.name}` }
        console.log(`[superAdminChat] tool=${p.functionCall.name}`)
        return { functionResponse: { name: p.functionCall.name, response: { result } } }
      })
    )

    contents  = [...contents, { role: 'user', parts: fnResponses }]
    data      = await callGemini(contents)
    candidate = data.candidates[0]
    contents  = [...contents, { role: 'model', parts: candidate.content.parts }]
  }

  const reply = candidate.content.parts.filter(p => p.text).map(p => p.text).join('').trim()
    || 'I was unable to generate a response. Please try again.'

  return { reply, history: contents }
})

// ── PayFast Subscription REST API ─────────────────────────────────────────────
// Separate from the Onsite flow. REST API authenticates with sorted params + sig.
// DO NOT reuse pfSignature here — Onsite uses insertion order; REST uses alpha sort.

function pfApiSignature(headersObj, bodyObj, passphrase) {
  const all = { ...headersObj, ...bodyObj }
  const str = Object.keys(all)
    .sort()
    .filter(k => all[k] !== undefined && all[k] !== null && String(all[k]) !== '')
    .map(k => `${k}=${encodeURIComponent(String(all[k])).replace(/%20/g, '+')}`)
    .join('&')
  const pp = passphrase ? passphrase.trim() : null
  const toSign = pp
    ? `${str}&passphrase=${encodeURIComponent(pp).replace(/%20/g, '+')}`
    : str
  return crypto.createHash('md5').update(toSign).digest('hex')
}

async function pfApiRequest({ method, path, bodyObj = {}, merchantId, passphrase, sandbox }) {
  const host      = sandbox ? 'https://api.sandbox.payfast.co.za' : 'https://api.payfast.co.za'
  const timestamp = new Date().toISOString()
  const version   = 'v1'
  const headersForSig = { 'merchant-id': merchantId, timestamp, version }
  const sig = pfApiSignature(headersForSig, bodyObj, passphrase)
  const reqConfig = {
    method,
    url: `${host}${path}`,
    headers: {
      'merchant-id': merchantId,
      timestamp,
      version,
      signature: sig,
      'Content-Type': 'application/json',
    },
  }
  if (method !== 'GET' && Object.keys(bodyObj).length > 0) reqConfig.data = bodyObj
  const resp = await axios(reqConfig)
  return resp.data
}

// ── cancelSubscription ────────────────────────────────────────────────────────
// Cancel-at-period-end: PayFast stops future charges but current period runs out.
// isActive stays true so the user keeps dashboard access until lapse.
exports.cancelSubscription = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_PASSPHRASE', 'SENDGRID_API_KEY'],
}, async (req) => {
  requireAuth(req)
  const uid = req.auth.uid
  try {
    const snap = await db.doc(`users/${uid}`).get()
    const user = snap.data()
    if (!user) return { success: false, error: 'User not found.' }

    const token = user.pfSubscriptionToken
    if (!token) return { success: false, error: 'No active subscription token found.' }
    if (user.paymentStatus === 'cancelled') return { success: false, error: 'Subscription is already cancelled.' }

    const merchantId = process.env.PAYFAST_MERCHANT_ID
    const sandbox    = merchantId === '10000100'

    await pfApiRequest({
      method: 'PUT', path: `/subscriptions/${token}/cancel`, bodyObj: {},
      merchantId, passphrase: process.env.PAYFAST_PASSPHRASE, sandbox,
    })

    await db.doc(`users/${uid}`).update({ paymentStatus: 'cancelled' })

    try {
      const cfg = getConfig()
      sgMail.setApiKey(cfg.sendgridKey)
      await sgMail.send({
        to:   user.email,
        from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
        subject: 'Your Tlhiso subscription has been cancelled',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
            <h2 style="color:#5B8E7D">Subscription Cancelled</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your Tlhiso subscription has been cancelled. You'll retain full access until the end of your current billing period.</p>
            <p>Want to continue? You can resubscribe at any time from your Settings page.</p>
            <p style="color:#64748B;font-size:12px;margin-top:24px;">Questions? <a href="mailto:hello@tlhiso.com" style="color:#5B8E7D">hello@tlhiso.com</a></p>
          </div>`,
      })
    } catch (emailErr) { console.error('cancelSubscription email error', emailErr.message) }

    return { success: true }
  } catch (e) {
    console.error('cancelSubscription error', e.response?.data ?? e.message)
    return { success: false, error: 'Could not cancel subscription. Please try again or contact support.' }
  }
})

// ── pauseSubscription ─────────────────────────────────────────────────────────
exports.pauseSubscription = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_PASSPHRASE'],
}, async (req) => {
  requireAuth(req)
  const uid    = req.auth.uid
  const cycles = Math.max(1, Math.min(12, Number(req.data?.cycles ?? 1)))
  try {
    const snap = await db.doc(`users/${uid}`).get()
    const user = snap.data()
    if (!user) return { success: false, error: 'User not found.' }

    const token = user.pfSubscriptionToken
    if (!token)                              return { success: false, error: 'No active subscription token found.' }
    if (user.paymentStatus === 'paused')     return { success: false, error: 'Subscription is already paused.' }
    if (user.paymentStatus === 'cancelled')  return { success: false, error: 'Cannot pause a cancelled subscription.' }

    const merchantId = process.env.PAYFAST_MERCHANT_ID
    const sandbox    = merchantId === '10000100'

    await pfApiRequest({
      method: 'PUT', path: `/subscriptions/${token}/pause`, bodyObj: { cycles },
      merchantId, passphrase: process.env.PAYFAST_PASSPHRASE, sandbox,
    })

    // PayFast quirk: unpausing early does NOT move the next billing date.
    // Access control while paused is the app's responsibility — we surface
    // paymentStatus:'paused' in the UI so the user knows their state.
    await db.doc(`users/${uid}`).update({
      paymentStatus: 'paused',
      pausedCycles:  cycles,
      pausedAt:      admin.firestore.FieldValue.serverTimestamp(),
    })

    return { success: true }
  } catch (e) {
    console.error('pauseSubscription error', e.response?.data ?? e.message)
    return { success: false, error: 'Could not pause subscription. Please try again or contact support.' }
  }
})

// ── resumeSubscription ────────────────────────────────────────────────────────
exports.resumeSubscription = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_PASSPHRASE'],
}, async (req) => {
  requireAuth(req)
  const uid = req.auth.uid
  try {
    const snap = await db.doc(`users/${uid}`).get()
    const user = snap.data()
    if (!user) return { success: false, error: 'User not found.' }

    const token = user.pfSubscriptionToken
    if (!token)                            return { success: false, error: 'No active subscription token found.' }
    if (user.paymentStatus !== 'paused')   return { success: false, error: 'Subscription is not currently paused.' }

    const merchantId = process.env.PAYFAST_MERCHANT_ID
    const sandbox    = merchantId === '10000100'

    await pfApiRequest({
      method: 'PUT', path: `/subscriptions/${token}/unpause`, bodyObj: {},
      merchantId, passphrase: process.env.PAYFAST_PASSPHRASE, sandbox,
    })

    await db.doc(`users/${uid}`).update({
      paymentStatus: 'active',
      pausedCycles:  admin.firestore.FieldValue.delete(),
      pausedAt:      admin.firestore.FieldValue.delete(),
    })

    return { success: true }
  } catch (e) {
    console.error('resumeSubscription error', e.response?.data ?? e.message)
    return { success: false, error: 'Could not resume subscription. Please try again or contact support.' }
  }
})

// ── changeSubscriptionPlan ────────────────────────────────────────────────────
// Updates the recurring_amount on PayFast then updates Firestore.
// Quota change takes effect on the next billing cycle via the IPN path.
// Do NOT reset messagesUsed here.
exports.changeSubscriptionPlan = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_PASSPHRASE'],
}, async (req) => {
  requireAuth(req)
  const uid = req.auth.uid
  const { planKey } = req.data ?? {}

  if (!PLAN_PRICES[planKey]) {
    return { success: false, error: 'Invalid plan. Choose starter, business, or enterprise.' }
  }

  try {
    const snap = await db.doc(`users/${uid}`).get()
    const user = snap.data()
    if (!user) return { success: false, error: 'User not found.' }

    const token = user.pfSubscriptionToken
    if (!token) {
      return {
        success: false,
        error:   'No subscription token on record. This may be an EFT account — email hello@tlhiso.com to change your plan.',
      }
    }

    if (user.plan === planKey) return { success: false, error: 'You are already on this plan.' }

    const planData   = PLAN_PRICES[planKey]
    const merchantId = process.env.PAYFAST_MERCHANT_ID
    const sandbox    = merchantId === '10000100'

    await pfApiRequest({
      method: 'PATCH', path: `/subscriptions/${token}/update`,
      bodyObj: { amount: parseFloat(planData.amount) },
      merchantId, passphrase: process.env.PAYFAST_PASSPHRASE, sandbox,
    })

    await db.doc(`users/${uid}`).update({ plan: planKey })

    return { success: true }
  } catch (e) {
    console.error('changeSubscriptionPlan error', e.response?.data ?? e.message)
    return { success: false, error: 'Could not change plan. Please try again or contact support.' }
  }
})

// ── Benchmarks ────────────────────────────────────────────────────────────────
// Zone B data engine: nightly anonymised cohort benchmarks across all active users.
// Writes to analytics/benchmarks — a single aggregated doc, never individual values.
// Cohorts below MIN_COHORT_SIZE are suppressed entirely to prevent reverse identification.

const MIN_COHORT_SIZE = 20

async function buildBenchmarks() {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const period = `${year}-${String(month + 1).padStart(2, '0')}`

  // Current-month window (UTC — consistent with how Cloud Functions run)
  const monthStart = admin.firestore.Timestamp.fromDate(new Date(year, month,     1, 0, 0, 0, 0))
  const monthEnd   = admin.firestore.Timestamp.fromDate(new Date(year, month + 1, 1, 0, 0, 0, 0))

  const usersSnap   = await db.collection('users').get()
  const activeUsers = usersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.isActive === true)

  // Gather per-user counts in parallel — counts only, no document bodies
  const userMetrics = await Promise.all(
    activeUsers.map(async u => {
      const contactCol = CONTACT_COLLECTION[u.industry] ?? 'customers'
      try {
        const [campSnap, msgSnap, apptSnap, contactSnap] = await Promise.all([
          // Campaigns sent this month — field name `sentAt` (set by processScheduledCampaigns)
          db.collection(`users/${u.id}/campaigns`)
            .where('sentAt', '>=', monthStart)
            .where('sentAt', '<', monthEnd)
            .count().get(),
          // Messages logged this month — field name `sentAt` (set by all send paths)
          db.collection(`users/${u.id}/messages`)
            .where('sentAt', '>=', monthStart)
            .where('sentAt', '<', monthEnd)
            .count().get(),
          // Appointments total
          db.collection(`users/${u.id}/appointments`).count().get(),
          // Contacts — industry-specific collection (reuses CONTACT_COLLECTION mapping)
          db.collection(`users/${u.id}/${contactCol}`).count().get(),
        ])
        return {
          industry:           u.industry,
          plan:               u.plan,
          campaignsThisMonth: campSnap.data().count,
          messagesThisMonth:  msgSnap.data().count,
          appointments:       apptSnap.data().count,
          contacts:           contactSnap.data().count,
        }
      } catch (e) {
        console.error(`[benchmarks] metrics error uid=${u.id}:`, e.message)
        // Return zeros rather than dropping the user from cohort counts
        return {
          industry:           u.industry,
          plan:               u.plan,
          campaignsThisMonth: 0,
          messagesThisMonth:  0,
          appointments:       0,
          contacts:           0,
        }
      }
    })
  )

  function avg(arr) {
    return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10 : 0
  }
  function median(arr) {
    if (!arr.length) return 0
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2 * 10) / 10 : s[m]
  }

  // THE ANONYMISATION GATE — cohorts below MIN_COHORT_SIZE produce no benchmark output
  function cohortStats(metrics) {
    const n = metrics.length
    if (n < MIN_COHORT_SIZE) return { suppressed: true, reason: 'cohort_too_small', cohortSize: n }
    const camps    = metrics.map(m => m.campaignsThisMonth)
    const msgs     = metrics.map(m => m.messagesThisMonth)
    const appts    = metrics.map(m => m.appointments)
    const contacts = metrics.map(m => m.contacts)
    return {
      suppressed:               false,
      cohortSize:               n,
      avgCampaignsPerMonth:     avg(camps),
      medianCampaigns:          median(camps),
      avgMessages:              avg(msgs),
      medianMessages:           median(msgs),
      avgAppointments:          avg(appts),
      avgContacts:              avg(contacts),
      pctWithCampaignThisMonth: Math.round(camps.filter(c => c > 0).length / n * 100),
    }
  }

  const byIndustry = {}
  for (const ind of ['b2b', 'medical', 'property', 'retail']) {
    byIndustry[ind] = cohortStats(userMetrics.filter(m => m.industry === ind))
  }

  const byPlan = {}
  for (const plan of ['starter', 'business', 'enterprise']) {
    byPlan[plan] = cohortStats(userMetrics.filter(m => m.plan === plan))
  }

  return {
    computedAt:       admin.firestore.FieldValue.serverTimestamp(),
    period,
    totalActiveUsers: activeUsers.length,
    byIndustry,
    byPlan,
  }
}

// Runs nightly at 00:00 UTC (02:00 SAST)
exports.computeBenchmarks = onSchedule(
  { schedule: '0 0 * * *', timeoutSeconds: 300 },
  async () => {
    console.log('[benchmarks] nightly compute starting')
    try {
      const result = await buildBenchmarks()
      await db.doc('analytics/benchmarks').set(result)
      console.log(`[benchmarks] written — period=${result.period}, activeUsers=${result.totalActiveUsers}`)
    } catch (e) {
      console.error('[benchmarks] error:', e.message)
    }
  }
)

// Super-admin callable — triggers an immediate recompute on demand
exports.recomputeBenchmarks = onCall({ timeoutSeconds: 300 }, async (req) => {
  requireSuperAdmin(req)
  try {
    const result = await buildBenchmarks()
    await db.doc('analytics/benchmarks').set(result)
    return { success: true, period: result.period }
  } catch (e) {
    console.error('[benchmarks] recompute error:', e.message)
    return { success: false, error: e.message }
  }
})

// ── Monthly Report Generator ──────────────────────────────────────────────────
// Reads analytics/benchmarks (ONLY) to produce two PDF outputs:
//   newsletter.pdf — public-facing, emailed to opted-in users
//   operator.pdf   — super-admin only, richer cohort detail
//
// STRUCTURAL SAFETY: buildReportData, renderNewsletterPDF, and renderOperatorPDF
// never query users or any user subcollection. They read only analytics/benchmarks.

const PDFDocument = require('pdfkit')

const REPORT_MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const REPORT_INDUSTRY_LABELS = {
  b2b:      'B2B & Professional Services',
  medical:  'Medical & Health',
  property: 'Property Management',
  retail:   'Consumer Business',
}
const REPORT_PLAN_LABELS = {
  starter:    'Starter',
  business:   'Professional',
  enterprise: 'Business',
}

// Reads ONLY analytics/benchmarks. No user collection queries — ever.
async function buildReportData() {
  const snap = await db.doc('analytics/benchmarks').get()
  if (!snap.exists) {
    throw new Error('Benchmark data not yet available. Run "Recompute Benchmarks" first.')
  }
  const data = snap.data()
  const [yr, mo] = data.period.split('-').map(Number)
  return {
    period:           data.period,
    periodLabel:      `${REPORT_MONTH_NAMES[mo - 1]} ${yr}`,
    totalActiveUsers: data.totalActiveUsers,
    byIndustry:       data.byIndustry ?? {},
    byPlan:           data.byPlan ?? {},
  }
}

// Builds the public-facing newsletter PDF from anonymised benchmark data only.
function renderNewsletterPDF(reportData) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks = []
    doc.on('data',  c => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const SAGE  = '#5B8E7D'
    const DARK  = '#1e293b'
    const MUTED = '#64748b'
    const W     = 495

    // Header band
    doc.rect(0, 0, 595, 110).fill(SAGE)
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('Tlhiso Market Pulse', 50, 28)
    doc.fontSize(14).font('Helvetica').text(reportData.periodLabel, 50, 58)
    doc.fontSize(9).fillColor('#d1fae5')
       .text("South Africa's direct-marketing intelligence platform", 50, 80)

    doc.moveDown(3.5)
    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text('About this report')
    doc.moveDown(0.4)
    doc.fillColor(MUTED).fontSize(9).font('Helvetica')
       .text(
         'The Tlhiso Market Pulse gives South African businesses an independent, anonymised view of how ' +
         'similar businesses are using direct marketing. All figures are platform averages — no individual ' +
         'business data is ever included.',
         { lineGap: 3, width: W }
       )

    doc.moveDown(1.2)
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('Platform snapshot')
    doc.moveDown(0.4)
    doc.fillColor(MUTED).fontSize(9).font('Helvetica')
       .text(`Active businesses on Tlhiso this month: ${reportData.totalActiveUsers}`, { lineGap: 2 })

    doc.moveDown(1.2)
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('Campaign benchmarks by industry')
    doc.moveDown(0.5)

    for (const [ind, stats] of Object.entries(reportData.byIndustry)) {
      const label = REPORT_INDUSTRY_LABELS[ind] ?? ind
      if (stats.suppressed) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique')
           .text(`${label}: Building this benchmark — more data coming soon.`, { lineGap: 2 })
        doc.moveDown(0.3)
        continue
      }
      doc.moveDown(0.5)
      doc.fillColor(SAGE).fontSize(10).font('Helvetica-Bold').text(label)
      doc.fillColor(MUTED).fontSize(9).font('Helvetica')
      doc.text(
        `Businesses on Tlhiso in this sector sent an average of ${stats.avgCampaignsPerMonth} campaigns last month.`,
        { lineGap: 2 }
      )
      doc.text(
        `Average messages sent: ${stats.avgMessages} · ${stats.pctWithCampaignThisMonth}% sent at least one campaign.`,
        { lineGap: 2 }
      )
      doc.text(`Median campaigns: ${stats.medianCampaigns}`, { lineGap: 2 })
      doc.moveDown(0.3)
    }

    doc.moveDown(0.8)
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('Activity by subscription tier')
    doc.moveDown(0.4)
    for (const [plan, stats] of Object.entries(reportData.byPlan)) {
      const label = REPORT_PLAN_LABELS[plan] ?? plan
      if (stats.suppressed) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique')
           .text(`${label} tier: Building this benchmark — more data coming soon.`, { lineGap: 2 })
        doc.moveDown(0.2)
        continue
      }
      doc.fillColor(MUTED).fontSize(9).font('Helvetica')
         .text(`${label}: avg ${stats.avgCampaignsPerMonth} campaigns/month · avg ${stats.avgMessages} messages`, { lineGap: 2 })
      doc.moveDown(0.2)
    }

    // Footer
    doc.moveDown(2)
    const lineY = doc.y
    doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor(MUTED).lineWidth(0.5).stroke()
    doc.moveDown(0.5)
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
       .text(
         'All figures are anonymised, aggregated platform averages — no individual business data is shown.  ·  hello@tlhiso.com  ·  tlhiso.com',
         { align: 'center', lineGap: 2, width: W }
       )
    doc.fontSize(7).text(`Tlhiso (Pty) Ltd  ·  POPIA compliant  ·  ${reportData.periodLabel}`, { align: 'center', width: W })

    doc.end()
  })
}

// Builds the super-admin-only operator PDF. Includes richer cohort detail.
function renderOperatorPDF(reportData) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks = []
    doc.on('data',  c => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const SAGE  = '#5B8E7D'
    const DARK  = '#1e293b'
    const MUTED = '#64748b'
    const W     = 495

    // Header
    doc.rect(0, 0, 595, 110).fill(DARK)
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('Tlhiso Operator Report', 50, 28)
    doc.fontSize(14).font('Helvetica').text(reportData.periodLabel, 50, 58)
    doc.fontSize(9).fillColor('#94a3b8')
       .text('CONFIDENTIAL — Super Admin only · not for distribution', 50, 80)

    doc.moveDown(3.5)
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('Platform overview')
    doc.moveDown(0.4)
    doc.fillColor(MUTED).fontSize(9).font('Helvetica')
       .text(`Total active users: ${reportData.totalActiveUsers}`, { lineGap: 2 })
       .text(`Period: ${reportData.periodLabel}`, { lineGap: 2 })

    doc.moveDown(1.2)
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('Industry cohort benchmarks')
    doc.moveDown(0.4)

    for (const [ind, stats] of Object.entries(reportData.byIndustry)) {
      const label = REPORT_INDUSTRY_LABELS[ind] ?? ind
      if (stats.suppressed) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique')
           .text(`${label}: Suppressed (cohort size ${stats.cohortSize ?? 0} — below ${MIN_COHORT_SIZE} threshold)`, { lineGap: 2 })
        doc.moveDown(0.2)
        continue
      }
      doc.moveDown(0.5)
      doc.fillColor(SAGE).fontSize(10).font('Helvetica-Bold').text(label)
      doc.fillColor(MUTED).fontSize(9).font('Helvetica')
      doc.text(`Cohort size: ${stats.cohortSize} active users`, { lineGap: 2 })
      doc.text(`Avg campaigns/month: ${stats.avgCampaignsPerMonth}  ·  median: ${stats.medianCampaigns}`, { lineGap: 2 })
      doc.text(`Avg messages: ${stats.avgMessages}  ·  median: ${stats.medianMessages}`, { lineGap: 2 })
      doc.text(`% with campaign this month: ${stats.pctWithCampaignThisMonth}%`, { lineGap: 2 })
      doc.text(`Avg appointments: ${stats.avgAppointments}  ·  avg contacts: ${stats.avgContacts}`, { lineGap: 2 })
      doc.moveDown(0.3)
    }

    doc.moveDown(0.8)
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text('Plan tier benchmarks')
    doc.moveDown(0.4)
    for (const [plan, stats] of Object.entries(reportData.byPlan)) {
      const label = REPORT_PLAN_LABELS[plan] ?? plan
      if (stats.suppressed) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique')
           .text(`${label}: Suppressed (cohort size ${stats.cohortSize ?? 0})`, { lineGap: 2 })
        doc.moveDown(0.2)
        continue
      }
      doc.fillColor(MUTED).fontSize(9).font('Helvetica')
         .text(
           `${label}: ${stats.cohortSize} users  ·  avg ${stats.avgCampaignsPerMonth} campaigns/month  ·  avg ${stats.avgMessages} messages`,
           { lineGap: 2 }
         )
      doc.moveDown(0.2)
    }

    // TODO: operator Zone A detail — per-user engagement breakdown (not yet implemented)

    // Footer
    doc.moveDown(2)
    const lineY = doc.y
    doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor(MUTED).lineWidth(0.5).stroke()
    doc.moveDown(0.5)
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
       .text(
         'CONFIDENTIAL — Tlhiso Operator Report  ·  Internal use only  ·  All cohort data anonymised per POPIA',
         { align: 'center', lineGap: 2, width: W }
       )
    doc.fontSize(7).text(`Tlhiso (Pty) Ltd  ·  ${reportData.periodLabel}`, { align: 'center', width: W })

    doc.end()
  })
}

// Generates the monthly report PDF, uploads to Storage, returns a 7-day signed URL.
// Does NOT email anyone. No secrets required.
exports.generateMonthlyReport = onCall({ timeoutSeconds: 120 }, async (req) => {
  requireSuperAdmin(req)
  const { type } = req.data
  if (type !== 'newsletter' && type !== 'operator') {
    throw new HttpsError('invalid-argument', 'type must be "newsletter" or "operator"')
  }

  try {
    const reportData = await buildReportData()
    const pdfBuffer  = type === 'newsletter'
      ? await renderNewsletterPDF(reportData)
      : await renderOperatorPDF(reportData)

    const storagePath = `reports/${reportData.period}/${type}.pdf`
    const file = storage.bucket().file(storagePath)
    await file.save(pdfBuffer, { contentType: 'application/pdf', resumable: false })

    const [signedUrl] = await file.getSignedUrl({
      action:  'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })

    // Count opted-in users now so the send-confirmation modal can show the recipient count
    const recipientSnap = await db.collection('users')
      .where('marketingConsent', '==', true)
      .where('isActive', '==', true)
      .get()

    await db.collection('superadmin').doc('data').collection('reports').add({
      type,
      period:      reportData.period,
      storagePath,
      generatedBy: req.auth.token.email,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`[report] ${type} generated for ${reportData.period}`)
    return {
      success:        true,
      downloadUrl:    signedUrl,
      period:         reportData.period,
      recipientCount: recipientSnap.size,
    }
  } catch (e) {
    console.error('[report] generateMonthlyReport error:', e.message)
    return { success: false, error: e.message }
  }
})

// Sends the pre-generated newsletter PDF to all opted-in active users.
// Requires confirm === true — returns error without sending if absent.
// Reads the stored PDF from Storage — does NOT regenerate from user data.
exports.sendMonthlyNewsletter = onCall({ timeoutSeconds: 300, secrets: ['SENDGRID_API_KEY'] }, async (req) => {
  requireSuperAdmin(req)
  const { period, confirm } = req.data

  if (!confirm) return { success: false, error: 'confirmation_required' }
  if (!period)  throw new HttpsError('invalid-argument', 'period is required (YYYY-MM)')

  const cfg = getConfig()
  sgMail.setApiKey(cfg.sendgridKey)

  try {
    // Load pre-generated PDF — does not touch user documents or subcollections
    const storagePath = `reports/${period}/newsletter.pdf`
    const file = storage.bucket().file(storagePath)
    const [exists] = await file.exists()
    if (!exists) {
      return {
        success: false,
        error:   `Newsletter PDF for ${period} has not been generated yet. Generate it first from the Insights tab.`,
      }
    }
    const [pdfBuffer] = await file.download()
    const pdfBase64   = pdfBuffer.toString('base64')

    // Fetch opted-in active users — single user-collection query for email addresses only
    const usersSnap    = await db.collection('users').where('isActive', '==', true).get()
    const allActive    = usersSnap.docs.map(d => d.data())
    const optedIn      = allActive.filter(u => u.marketingConsent === true && !!u.email)
    const skippedOptOut = allActive.length - optedIn.length

    if (optedIn.length === 0) {
      return { success: true, sentCount: 0, skippedOptOut, message: 'No opted-in users to send to.' }
    }

    const [yr, mo]  = period.split('-').map(Number)
    const monthName = REPORT_MONTH_NAMES[mo - 1]
    const subject   = `Tlhiso Market Pulse — ${monthName} ${yr}`
    const htmlBody  = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#5B8E7D;padding:32px;border-radius:12px 12px 0 0">
          <h1 style="color:#ffffff;margin:0;font-size:22px">Tlhiso Market Pulse</h1>
          <p style="color:#d1fae5;margin:8px 0 0;font-size:14px">${monthName} ${yr}</p>
        </div>
        <div style="padding:24px;background:#f8fafc;border-radius:0 0 12px 12px">
          <p style="color:#475569">Hi there,</p>
          <p style="color:#475569">Your monthly Tlhiso Market Pulse report is attached. It contains anonymised benchmark data showing how businesses like yours are performing across South Africa.</p>
          <p style="color:#475569">Open the attached PDF to see campaign benchmarks by industry and subscription tier — all anonymised, all aggregated. No individual business data is ever shared.</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">All figures are anonymised, aggregated platform averages — no individual business data is shown.<br>To unsubscribe from marketing emails, reply with "unsubscribe".</p>
        </div>
      </div>
    `

    const BATCH = 900
    let sentCount = 0
    for (let i = 0; i < optedIn.length; i += BATCH) {
      const batch = optedIn.slice(i, i + BATCH)
      await sgMail.send({
        personalizations: batch.map(u => ({ to: [{ email: u.email, name: u.name || '' }] })),
        from:        { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
        subject,
        html:        htmlBody,
        attachments: [{
          content:     pdfBase64,
          filename:    `Tlhiso-Market-Pulse-${period}.pdf`,
          type:        'application/pdf',
          disposition: 'attachment',
        }],
      })
      sentCount += batch.length
    }

    await db.collection('superadmin').doc('data').collection('newsletterSends').add({
      period,
      sentCount,
      skippedOptOut,
      sentBy:  req.auth.token.email,
      sentAt:  admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`[newsletter] sent period=${period} sentCount=${sentCount} skipped=${skippedOptOut}`)
    return { success: true, sentCount, skippedOptOut }
  } catch (e) {
    console.error('[newsletter] sendMonthlyNewsletter error:', e.message)
    return { success: false, error: e.message }
  }
})

// ── Events module ─────────────────────────────────────────────────────────────
const eventsModule = require('./events.js')
Object.assign(exports, eventsModule)
