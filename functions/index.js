const { onCall, onRequest } = require('firebase-functions/v2/https')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')
const sgMail = require('@sendgrid/mail')
const axios = require('axios')
const twilio = require('twilio')

admin.initializeApp()
const db = admin.firestore()
const storage = admin.storage()

// ── Config (set via: firebase functions:secrets:set KEY) ─────────────────────
const getConfig = () => ({
  sendgridKey: process.env.SENDGRID_API_KEY,
  sendgridFrom: process.env.SENDGRID_FROM_EMAIL || 'hello@tlhiso.com',
  sendgridFromName: process.env.SENDGRID_FROM_NAME || 'Tlhiso',
  bulksmsTokenId: process.env.BULKSMS_TOKEN_ID,
  bulksmsTokenSecret: process.env.BULKSMS_TOKEN_SECRET,
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioNumber: process.env.TWILIO_NUMBER,
  twilioWhatsapp: process.env.TWILIO_WHATSAPP_NUMBER,
})

// ── 1. sendEmail ──────────────────────────────────────────────────────────────
exports.sendEmail = onCall({ secrets: ['SENDGRID_API_KEY'] }, async (req) => {
  const { to, subject, htmlBody, templateId } = req.data
  if (!to || !htmlBody) return { success: false, error: 'Missing to or htmlBody' }
  const cfg = getConfig()
  sgMail.setApiKey(cfg.sendgridKey)
  try {
    const msg = {
      to,
      from: { email: cfg.sendgridFrom, name: cfg.sendgridFromName },
      subject: subject || '(no subject)',
      html: htmlBody,
    }
    if (templateId) msg.templateId = templateId
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

// ── 4. transcribeConsultation ─────────────────────────────────────────────────
exports.transcribeConsultation = onCall(async (req) => {
  const { storagePath } = req.data
  if (!storagePath) return { success: false, error: 'Missing storagePath' }
  const ASSEMBLY_KEY = process.env.ASSEMBLYAI_API_KEY
  if (!ASSEMBLY_KEY) return { success: false, error: 'AssemblyAI key not configured' }
  try {
    const bucket = storage.bucket()
    const file = bucket.file(storagePath)
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 10 })
    // Submit to AssemblyAI
    const submitResp = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: url },
      { headers: { authorization: ASSEMBLY_KEY } }
    )
    const transcriptId = submitResp.data.id
    // Poll until complete (max 2 mins)
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const poll = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLY_KEY },
      })
      if (poll.data.status === 'completed') return { success: true, transcript: poll.data.text }
      if (poll.data.status === 'error') throw new Error(poll.data.error)
    }
    return { success: false, error: 'Transcription timed out' }
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

// ── 6. sendActivationEmail (called from super admin) ─────────────────────────
exports.sendActivationEmail = onCall({ secrets: ['SENDGRID_API_KEY'] }, async (req) => {
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
