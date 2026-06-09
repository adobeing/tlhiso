/**
 * Format any date value to DD/MM/YYYY (South Africa standard).
 * Handles:
 *  - YYYY-MM-DD strings (from <input type="date">)
 *  - Firebase Timestamps (have .toDate())
 *  - JS Date objects
 *  - null / undefined → '—'
 */
export function fmtDate(val) {
  if (!val) return '—'

  let d
  if (val?.toDate) {
    // Firebase Timestamp
    d = val.toDate()
  } else if (val instanceof Date) {
    d = val
  } else if (typeof val === 'string') {
    // YYYY-MM-DD — parse as local date to avoid UTC-offset shifting the day
    const [y, m, day] = val.split('-').map(Number)
    if (!y || !m || !day) return val
    d = new Date(y, m - 1, day)
  } else {
    return '—'
  }

  if (isNaN(d.getTime())) return '—'

  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
