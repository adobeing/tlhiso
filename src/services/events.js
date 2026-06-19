import {
  collection, doc, addDoc, updateDoc, getDocs, onSnapshot,
  serverTimestamp, query, where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { db, functions, storage } from './firebase'

export const GUEST_PRICE_ZAR = 6
export const VAT_RATE = 0.15

export function quoteForGuests(n) {
  const net = n * GUEST_PRICE_ZAR
  const vat = net * VAT_RATE
  return { net, vat, total: net + vat }
}

export async function createEvent(uid, data) {
  return addDoc(collection(db, 'events'), {
    ...data,
    organizerUid: uid,
    status: 'draft',
    paymentStatus: 'unpaid',
    createdAt: serverTimestamp(),
  })
}

export async function updateEvent(eventId, data) {
  return updateDoc(doc(db, 'events', eventId), data)
}

export async function uploadCoverImage(eventId, file) {
  const r = ref(storage, `events/${eventId}/cover`)
  await uploadBytes(r, file)
  return getDownloadURL(r)
}

export async function addGuest(eventId, guest) {
  const token = crypto.randomUUID().replace(/-/g, '')
  return addDoc(collection(db, 'events', eventId, 'guests'), {
    ...guest,
    inviteToken: token,
    rsvpStatus: 'pending',
    touchpoints: { invite: false, reminder: false, thankyou: false },
    createdAt: serverTimestamp(),
  })
}

export async function getGuests(eventId) {
  const snap = await getDocs(collection(db, 'events', eventId, 'guests'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function watchEvent(eventId, cb) {
  return onSnapshot(doc(db, 'events', eventId), snap => cb({ id: snap.id, ...snap.data() }))
}

export function watchGuests(eventId, cb) {
  return onSnapshot(collection(db, 'events', eventId, 'guests'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

export function watchOrganizerEvents(uid, cb) {
  return onSnapshot(
    query(collection(db, 'events'), where('organizerUid', '==', uid)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

export async function createEventCheckout(eventId) {
  return httpsCallable(functions, 'createEventCheckout')({ eventId })
}

export async function launchEvent(eventId) {
  return httpsCallable(functions, 'launchEvent')({ eventId })
}

export async function sendEventReminder(eventId) {
  return httpsCallable(functions, 'sendEventReminder')({ eventId })
}

export async function sendEventThankYou(eventId) {
  return httpsCallable(functions, 'sendEventThankYou')({ eventId })
}
