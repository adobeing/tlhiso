const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const axios = require('axios')
const crypto = require('crypto')

const db = () => admin.firestore()

const GUEST_PRICE = 6
const VAT = 0.15

function pfSignature(fields, passphrase) {
  const pfString = Object.entries(fields)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&')
  const pp = passphrase ? passphrase.trim() : null
  const toSign = pp ? `${pfString}&passphrase=${encodeURIComponent(pp).replace(/%20/g, '+')}` : pfString
  return crypto.createHash('md5').update(toSign).digest('hex')
}

// Creates a one-time PayFast payment for the event (guestCount × R6 + 15% VAT)
exports.createEventCheckout = onCall({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_MERCHANT_KEY', 'PAYFAST_PASSPHRASE'],
}, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { eventId } = req.data
  const eventRef = db().collection('events').doc(eventId)
  const snap = await eventRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Event not found.')
  const event = snap.data()
  if (event.organizerUid !== req.auth.uid) throw new HttpsError('permission-denied', 'Not your event.')

  const guestsSnap = await db().collection('events').doc(eventId).collection('guests').get()
  const guestCount = guestsSnap.size
  if (guestCount === 0) throw new HttpsError('failed-precondition', 'Add guests before launching.')

  const net = guestCount * GUEST_PRICE
  const total = (net * (1 + VAT)).toFixed(2)

  const merchantId  = process.env.PAYFAST_MERCHANT_ID
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY
  const passphrase  = process.env.PAYFAST_PASSPHRASE
  const isSandbox   = merchantId === '10000100'
  const host        = isSandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'

  const userSnap = await db().collection('users').doc(req.auth.uid).get()
  const user = userSnap.exists ? userSnap.data() : {}
  const nameParts = (user.name || 'Organiser').trim().split(/\s+/)

  const fields = {
    merchant_id:  merchantId,
    merchant_key: merchantKey,
    return_url:   `https://tlhiso.com/events/${eventId}`,
    cancel_url:   `https://tlhiso.com/events/${eventId}`,
    notify_url:   `https://us-central1-tlhiso.cloudfunctions.net/eventPaymentIPN`,
    name_first:   nameParts[0],
    name_last:    nameParts.slice(1).join(' ') || 'Organiser',
    email_address: user.email || req.auth.token?.email || '',
    m_payment_id: eventId,
    amount:       total,
    item_name:    `${event.title || 'Event'} — ${guestCount} guests`,
    custom_str1:  eventId,
    custom_str2:  String(guestCount),
  }
  fields.signature = pfSignature(fields, passphrase || null)

  const body = Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
    .join('&')

  try {
    const resp = await axios.post(`https://${host}/onsite/process`, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if (!resp.data?.uuid) throw new Error(JSON.stringify(resp.data))
    // Save snapshot of what we're about to charge
    await eventRef.update({ guestCount, amountChargedZar: parseFloat(total), paymentRef: resp.data.uuid })
    return { uuid: resp.data.uuid, sandbox: isSandbox, amount: total, guestCount }
  } catch (e) {
    const raw = typeof e.response?.data === 'string' ? e.response.data : ''
    const text = raw.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
    console.error('createEventCheckout error:', text.slice(0, 400) || e.message)
    throw new HttpsError('internal', 'Payment setup failed. Please try again.')
  }
})

// IPN handler for event payments (called by PayFast after payment)
exports.eventPaymentIPN = onRequest({
  secrets: ['PAYFAST_MERCHANT_ID', 'PAYFAST_PASSPHRASE', 'SENDGRID_API_KEY', 'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET'],
}, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
  res.status(200).send('OK') // acknowledge immediately

  try {
    const data = { ...req.body }
    const receivedSig = data.signature
    delete data.signature

    const passphrase = process.env.PAYFAST_PASSPHRASE
    const expectedSig = pfSignature(data, passphrase || null)
    if (receivedSig !== expectedSig) {
      console.error('eventPaymentIPN: signature mismatch')
      return
    }

    if (data.payment_status !== 'COMPLETE') return

    const eventId = data.custom_str1
    const guestCount = parseInt(data.custom_str2 || '0', 10)
    const amountGross = parseFloat(data.amount_gross || '0')

    const eventRef = db().collection('events').doc(eventId)
    await eventRef.update({
      paymentStatus: 'paid',
      guestCount,
      amountChargedZar: amountGross,
      status: 'launched',
      launchedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // Send invites to all guests
    const guestsSnap = await db().collection('events').doc(eventId).collection('guests').get()
    const eventSnap = await eventRef.get()
    const event = eventSnap.data()

    for (const gDoc of guestsSnap.docs) {
      const guest = gDoc.data()
      if (guest.touchpoints?.invite) continue
      const link = `https://tlhiso.com/e/${eventId}/${guest.inviteToken}`
      const startStr = event.startDate?.toDate
        ? event.startDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
        : ''

      if (guest.email) {
        const sgMail = require('@sendgrid/mail')
        sgMail.setApiKey(process.env.SENDGRID_API_KEY)
        await sgMail.send({
          to: guest.email,
          from: { email: 'hello@notifications.tlhiso.com', name: 'Tlhiso Events' },
          replyTo: 'hello@tlhiso.com',
          subject: `You're invited: ${event.title}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#5B8E7D">${event.title}</h2>
            <p>Hi ${guest.name},</p>
            <p>You've been invited to <strong>${event.title}</strong>${startStr ? ` on ${startStr}` : ''}.</p>
            ${event.location?.name ? `<p>&#128205; ${event.location.name}${event.location.address ? `, ${event.location.address}` : ''}</p>` : ''}
            ${event.bio ? `<p>${event.bio}</p>` : ''}
            <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#5B8E7D;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">RSVP Now</a>
            <p style="color:#64748b;font-size:12px">Your response helps the organiser plan. <a href="${link}">View invite</a></p>
          </div>`,
        }).catch(e => console.error('invite email error:', e.message))
      }

      if (guest.phone) {
        const phone = guest.phone.startsWith('+27') ? guest.phone : '+27' + guest.phone.replace(/^0/, '')
        const smsBody = `You're invited to ${event.title}. RSVP: ${link}`
        await axios.post('https://api.bulksms.com/v1/messages', [{ to: phone, body: smsBody }], {
          auth: { username: process.env.BULKSMS_TOKEN_ID, password: process.env.BULKSMS_TOKEN_SECRET },
        }).catch(e => console.error('invite sms error:', e.message))
      }

      await gDoc.ref.update({ 'touchpoints.invite': true })
    }
  } catch (e) {
    console.error('eventPaymentIPN error:', e.message)
  }
})

// launchEvent — called from the frontend after PayFast onsite payment succeeds
// (belt-and-suspenders: the IPN also sets status=launched, but the onsite callback
//  fires immediately in the browser so we update optimistically)
exports.launchEvent = onCall({}, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { eventId } = req.data
  const eventRef = db().collection('events').doc(eventId)
  const snap = await eventRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Event not found.')
  const event = snap.data()
  if (event.organizerUid !== req.auth.uid) throw new HttpsError('permission-denied', 'Not your event.')

  // Only update if still in draft/unpaid state — IPN may have already set launched
  if (event.status === 'draft') {
    await eventRef.update({
      status: 'launched',
      launchedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }
  return { success: true }
})

// Submit RSVP (public — no auth, called from EventInvitePublicPage)
exports.submitRsvp = onCall({}, async (req) => {
  const { eventId, inviteToken, rsvpStatus, plusOneName, dietary } = req.data
  if (!eventId || !inviteToken || !rsvpStatus) throw new HttpsError('invalid-argument', 'Missing fields.')

  const guestsSnap = await db().collection('events').doc(eventId).collection('guests')
    .where('inviteToken', '==', inviteToken).limit(1).get()

  if (guestsSnap.empty) throw new HttpsError('not-found', 'Invite not found.')
  const gDoc = guestsSnap.docs[0]

  await gDoc.ref.update({
    rsvpStatus,
    respondedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(plusOneName !== undefined ? { plusOne: true, plusOneName } : {}),
    ...(dietary !== undefined ? { dietary } : {}),
  })
  return { success: true }
})

// Send reminder to all going + pending guests
exports.sendEventReminder = onCall({
  secrets: ['SENDGRID_API_KEY', 'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET'],
}, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { eventId } = req.data
  const eventSnap = await db().collection('events').doc(eventId).get()
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.')
  const event = eventSnap.data()
  if (event.organizerUid !== req.auth.uid) throw new HttpsError('permission-denied', 'Not your event.')

  const guestsSnap = await db().collection('events').doc(eventId).collection('guests').get()
  const startStr = event.startDate?.toDate
    ? event.startDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  for (const gDoc of guestsSnap.docs) {
    const guest = gDoc.data()
    if (guest.touchpoints?.reminder) continue
    if (guest.rsvpStatus === 'declined') continue
    const link = `https://tlhiso.com/e/${eventId}/${guest.inviteToken}`

    if (guest.email) {
      const sgMail = require('@sendgrid/mail')
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      await sgMail.send({
        to: guest.email,
        from: { email: 'hello@notifications.tlhiso.com', name: 'Tlhiso Events' },
        replyTo: 'hello@tlhiso.com',
        subject: `Reminder: ${event.title}${startStr ? ` — ${startStr}` : ''}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#5B8E7D">Reminder: ${event.title}</h2>
          <p>Hi ${guest.name}, just a reminder about <strong>${event.title}</strong>${startStr ? ` on ${startStr}` : ''}.</p>
          ${event.location?.name ? `<p>&#128205; ${event.location.name}</p>` : ''}
          ${guest.rsvpStatus === 'pending' ? `<a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#5B8E7D;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">RSVP Now</a>` : ''}
        </div>`,
      }).catch(e => console.error('reminder email error:', e.message))
    }
    if (guest.phone) {
      const phone = guest.phone.startsWith('+27') ? guest.phone : '+27' + guest.phone.replace(/^0/, '')
      await axios.post('https://api.bulksms.com/v1/messages', [{
        to: phone,
        body: `Reminder: ${event.title}${startStr ? ` on ${startStr}` : ''}. ${link}`,
      }], {
        auth: { username: process.env.BULKSMS_TOKEN_ID, password: process.env.BULKSMS_TOKEN_SECRET },
      }).catch(e => console.error('reminder sms error:', e.message))
    }
    await gDoc.ref.update({ 'touchpoints.reminder': true })
  }
  return { success: true }
})

// Send thank-you to all going guests
exports.sendEventThankYou = onCall({
  secrets: ['SENDGRID_API_KEY', 'BULKSMS_TOKEN_ID', 'BULKSMS_TOKEN_SECRET'],
}, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in required.')
  const { eventId } = req.data
  const eventSnap = await db().collection('events').doc(eventId).get()
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.')
  const event = eventSnap.data()
  if (event.organizerUid !== req.auth.uid) throw new HttpsError('permission-denied', 'Not your event.')

  const guestsSnap = await db().collection('events').doc(eventId).collection('guests').get()

  for (const gDoc of guestsSnap.docs) {
    const guest = gDoc.data()
    if (guest.touchpoints?.thankyou) continue
    if (guest.rsvpStatus !== 'going') continue

    if (guest.email) {
      const sgMail = require('@sendgrid/mail')
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      await sgMail.send({
        to: guest.email,
        from: { email: 'hello@notifications.tlhiso.com', name: 'Tlhiso Events' },
        replyTo: 'hello@tlhiso.com',
        subject: `Thank you for attending ${event.title}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#5B8E7D">Thank you!</h2>
          <p>Hi ${guest.name}, thank you for attending <strong>${event.title}</strong>. We hope you had a great time!</p>
        </div>`,
      }).catch(e => console.error('thankyou email error:', e.message))
    }
    if (guest.phone) {
      const phone = guest.phone.startsWith('+27') ? guest.phone : '+27' + guest.phone.replace(/^0/, '')
      await axios.post('https://api.bulksms.com/v1/messages', [{
        to: phone, body: `Thank you for attending ${event.title}! We hope to see you again.`,
      }], {
        auth: { username: process.env.BULKSMS_TOKEN_ID, password: process.env.BULKSMS_TOKEN_SECRET },
      }).catch(e => console.error('thankyou sms error:', e.message))
    }
    await gDoc.ref.update({ 'touchpoints.thankyou': true })
  }

  await db().collection('events').doc(eventId).update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() })
  return { success: true }
})
