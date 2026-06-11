import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase'

// Returns the live collection array directly (backward-compatible).
// Also exposes .loading and .error as properties on the returned array
// so callers can opt in to those without any destructuring change.
export function useCollection(path, orderField = 'createdAt') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!path) { setData([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    const q = query(collection(db, path), orderBy(orderField, 'desc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      err => {
        console.error('[useCollection] snapshot error', path, err)
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [path, orderField])

  // Attach loading/error as non-enumerable properties so the array can be
  // used directly (data.map, data.filter, etc.) while still exposing status.
  const out = data.slice()
  Object.defineProperty(out, 'loading', { value: loading, enumerable: false })
  Object.defineProperty(out, 'error',   { value: error,   enumerable: false })
  return out
}
