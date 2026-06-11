import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import Papa from 'papaparse'

const PAGE_SIZE = 10

// Raw cell value for search/CSV — render() output may be a React element,
// so always fall back to the underlying row field.
function rawValue(row, col) {
  const v = row[col.key]
  if (v == null) return ''
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    return v.toDate().toLocaleDateString('en-ZA')
  }
  return v
}

export default function DataTable({ columns, data, onRowClick, emptyMessage = 'No records found.' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(0)

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(row =>
      columns.some(col => String(rawValue(row, col)).toLowerCase().includes(q))
    )
  }, [data, columns, search])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const an = Number(av), bn = Number(bv)
      const cmp = (av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn))
        ? an - bn
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage  = Math.min(page, pageCount - 1)
  const pageRows  = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  function exportCSV() {
    const rows = sorted.map(row =>
      Object.fromEntries(columns.map(c => [c.label, rawValue(row, c)]))
    )
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-surface-2/60 px-5 py-3">
        <span className="text-xs font-medium text-ink-secondary">
          {search.trim()
            ? `${filtered.length} of ${data.length} record${data.length !== 1 ? 's' : ''}`
            : `${data.length} record${data.length !== 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-2">
          {data.length > 5 && (
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-secondary/60" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search…"
                className="w-40 rounded-lg border border-border bg-white py-1.5 pl-7 pr-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-secondary shadow-sm transition hover:bg-surface-2 hover:text-ink"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-surface-2/40">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && toggleSort(col.key)}
                  className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-secondary/80 ${col.sortable !== false ? 'cursor-pointer select-none hover:text-ink' : ''}`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-ink-secondary">
                  {search.trim() ? `No records match "${search.trim()}".` : emptyMessage}
                </td>
              </tr>
            ) : pageRows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors duration-100 hover:bg-surface-2/70 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3.5 text-ink">
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border/70 bg-surface-2/40 px-5 py-2.5">
          <span className="text-xs text-ink-secondary">
            Page {safePage + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-white text-ink-secondary transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-white text-ink-secondary transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
