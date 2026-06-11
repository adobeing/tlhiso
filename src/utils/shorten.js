/**
 * Shorten a URL using the is.gd API (free, no key, CORS-enabled).
 * Falls back silently to the original URL if the service is unavailable.
 */
export async function shortenUrl(url) {
  try {
    const res = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return url
    const short = (await res.text()).trim()
    return short.startsWith('http') ? short : url
  } catch {
    return url
  }
}
