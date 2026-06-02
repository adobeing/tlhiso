import { httpsCallable } from 'firebase/functions'
import { doc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { functions, db } from './firebase'
import { auth } from './firebase'

const callFn = (name, data) => httpsCallable(functions, name)(data)

export async function sendMessage({ type, to, subject, body, module: mod = 'general' }) {
  const uid = auth.currentUser?.uid
  let result
  switch (type) {
    case 'email':
      result = await callFn('sendEmail', { to, subject, htmlBody: body })
      break
    case 'sms':
      result = await callFn('sendSMS', { to, message: body })
      break
    case 'whatsapp':
      result = await callFn('sendWhatsApp', { to, message: body })
      break
    default:
      throw new Error(`Unknown message type: ${type}`)
  }

  if (uid) {
    await addDoc(collection(db, 'users', uid, 'messages'), {
      to, type, subject: subject ?? null, body,
      sentAt: serverTimestamp(),
      status: result?.data?.success ? 'sent' : 'failed',
      module: mod,
    })
  }
  return result
}
