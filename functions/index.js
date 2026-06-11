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
        const planKey   = userData.plan ?? 'starter'
        const limit     = PLAN_LIMITS[planKey] ?? 100
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
  const toSign = passphrase
    ? `${pfString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
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
  const passphrase  = process.env.PAYFAST_PASSPHRASE
  const isSandbox   = merchantId === '10000100'
  const host        = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'

  const nameParts = (user.name || 'User').trim().split(/\s+/)
  const today     = new Date().toISOString().slice(0, 10)

  const fields = {
    merchant_id:      merchantId,
    merchant_key:     merchantKey,
    return_url:       'https://tlhiso.com/checkout/complete',
    cancel_url:       'https://tlhiso.com/checkout',
    notify_url:       'https://us-central1-tlhiso.cloudfunctions.net/payfastIPN',
    name_first:       nameParts[0],
    name_last:        nameParts.slice(1).join(' ') || 'User',
    email_address:    user.email,
    m_payment_id:     uid,
    amount:           planData.amount,
    item_name:        planData.name,
    subscription_type: '1',
    billing_date:     today,
    recurring_amount: planData.amount,
    frequency:        '3',
    cycles:           '0',
  }
  fields.signature = pfSignature(fields, passphrase)

  const body = Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
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
    console.error('createPayfastCheckout error', e.response?.data ?? e.message)
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
  const passphrase = process.env.PAYFAST_PASSPHRASE
  const expectedSig = pfSignature(data, passphrase)
  if (receivedSig !== expectedSig) {
    console.error('payfastIPN: signature mismatch', { received: receivedSig, expected: expectedSig })
    res.status(400).send('Invalid signature')
    return
  }

  const uid           = data.m_payment_id
  const paymentStatus = data.payment_status
  const pfPaymentId   = data.pf_payment_id

  if (!uid) { res.status(400).send('Missing m_payment_id'); return }

  if (paymentStatus === 'COMPLETE') {
    try {
      // Activate user
      await db.collection('users').doc(uid).update({
        isActive:         true,
        paidAt:           admin.firestore.FieldValue.serverTimestamp(),
        paymentStatus:    'active',
        payfastPaymentId: pfPaymentId || null,
      })

      // Send welcome email
      const cfg = getConfig()
      sgMail.setApiKey(cfg.sendgridKey)
      const userSnap = await db.collection('users').doc(uid).get()
      const user = userSnap.data()
      if (user?.email) {
        await sgMail.send({
          to: user.email,
          from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
          subject: '🎉 Your Tlhiso subscription is active!',
          html: `
            <h2>Welcome to Tlhiso!</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your <strong>${PLAN_PRICES[user.plan]?.name || 'Tlhiso'}</strong> subscription is now active.
            You can log in and start using your dashboard right away.</p>
            <p><a href="https://tlhiso.com/login"
              style="background:#5B8E7D;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">
              Go to my dashboard →
            </a></p>
            <p style="color:#64748B;font-size:12px;margin-top:24px;">Questions? hello@tlhiso.com</p>
          `,
        })
      }
      console.log(`payfastIPN: activated uid=${uid}, pfPaymentId=${pfPaymentId}`)
    } catch (e) {
      console.error('payfastIPN: activation error', e.message)
      res.status(500).send('Activation error')
      return
    }
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
        const planKey   = userData.plan ?? 'starter'
        const limit     = PLAN_LIMITS[planKey] ?? 1000
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
