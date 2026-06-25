import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot,
  serverTimestamp, query, where, deleteField,
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

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function blankTier() {
  return { id: crypto.randomUUID(), name: '', priceZar: 0, quantity: 0, sold: 0 }
}

export function blankQuestion() {
  return { id: crypto.randomUUID(), label: '', type: 'text', options: [], required: false }
}

export function tierCapacity(tiers = []) {
  return tiers.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0)
}

export function tiersSold(tiers = []) {
  return tiers.reduce((sum, t) => sum + (Number(t.sold) || 0), 0)
}

export function tierRevenue(tiers = []) {
  return tiers.reduce((sum, t) => sum + (Number(t.priceZar) || 0) * (Number(t.sold) || 0), 0)
}

export function rsvpStats(guests = []) {
  const going    = guests.filter(g => g.rsvpStatus === 'going')
  const declined = guests.filter(g => g.rsvpStatus === 'declined')
  const pending  = guests.filter(g => g.rsvpStatus === 'pending')
  const checkedIn = guests.filter(g => g.checkedIn === true)
  const plusOnes  = going.reduce((sum, g) => sum + (Number(g.plusOneCount) || 0), 0)
  return {
    total:            guests.length,
    accepted:         going.length,
    declined:         declined.length,
    pending:          pending.length,
    checkedIn:        checkedIn.length,
    plusOnes,
    expectedHeadcount: going.length + plusOnes,
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

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

export function watchEvent(eventId, cb) {
  return onSnapshot(doc(db, 'events', eventId), snap => cb({ id: snap.id, ...snap.data() }))
}

export function watchOrganizerEvents(uid, cb) {
  return onSnapshot(
    query(collection(db, 'events'), where('organizerUid', '==', uid)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

// ── Guests ────────────────────────────────────────────────────────────────────

export async function addGuest(eventId, guest) {
  const token = crypto.randomUUID().replace(/-/g, '')
  return addDoc(collection(db, 'events', eventId, 'guests'), {
    ...guest,
    inviteToken: token,
    rsvpStatus: 'pending',
    checkedIn: false,
    checkedInAt: null,
    touchpoints: { invite: false, reminder: false, thankyou: false },
    createdAt: serverTimestamp(),
  })
}

export async function updateGuest(eventId, guestId, data) {
  return updateDoc(doc(db, 'events', eventId, 'guests', guestId), data)
}

export async function removeGuestDoc(eventId, guestId) {
  return deleteDoc(doc(db, 'events', eventId, 'guests', guestId))
}

export async function checkInGuest(eventId, guestId, by = '') {
  return updateDoc(doc(db, 'events', eventId, 'guests', guestId), {
    checkedIn: true,
    checkedInAt: serverTimestamp(),
    checkedInBy: by || '',
  })
}

export async function undoCheckIn(eventId, guestId) {
  return updateDoc(doc(db, 'events', eventId, 'guests', guestId), {
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: deleteField(),
  })
}

export async function getGuests(eventId) {
  const snap = await getDocs(collection(db, 'events', eventId, 'guests'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function watchGuests(eventId, cb) {
  return onSnapshot(collection(db, 'events', eventId, 'guests'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

// Public RSVP helper — calls Cloud Function which writes via admin SDK (bypasses rules)
export async function submitRsvp(eventId, guestId, data) {
  return httpsCallable(functions, 'submitRsvp')({ eventId, guestId, ...data })
}

// ── Tables subcollection ──────────────────────────────────────────────────────

export async function addTable(eventId, tableData) {
  return addDoc(collection(db, 'events', eventId, 'tables'), {
    ...tableData,
    createdAt: serverTimestamp(),
  })
}

export async function updateTable(eventId, tableId, data) {
  return updateDoc(doc(db, 'events', eventId, 'tables', tableId), data)
}

export async function removeTable(eventId, tableId) {
  return deleteDoc(doc(db, 'events', eventId, 'tables', tableId))
}

export async function getTables(eventId) {
  const snap = await getDocs(collection(db, 'events', eventId, 'tables'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function watchTables(eventId, cb) {
  return onSnapshot(collection(db, 'events', eventId, 'tables'), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
}

export async function assignGuestToTable(eventId, guestId, tableId, tableName) {
  return updateGuest(eventId, guestId, { tableId, tableName })
}

// ── Cloud Function wrappers ───────────────────────────────────────────────────

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
