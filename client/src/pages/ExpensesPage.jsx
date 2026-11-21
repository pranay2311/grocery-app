import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import ShareToggle from '../components/ShareToggle.jsx'
import SpendChart from '../components/SpendChart.jsx'
import { CATEGORIES, categoryIcon, euro, formatDate } from '../format.js'

const PERIOD_COUNT = { week: 12, month: 12 }
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

// Receipt dates are stored as midnight UTC, so all date math here uses UTC to avoid day shifts.
function startOfWeek(d) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  s.setUTCDate(s.getUTCDate() - ((s.getUTCDay() + 6) % 7)) // weeks start on Monday
  return s
}
const startOfMonth = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const ddmm = (d) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.`

// The last N weeks/months up to today, including ones with no spending
function buildPeriods(kind, receipts) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const periods = []
  for (let i = PERIOD_COUNT[kind] - 1; i >= 0; i--) {
    let start, end, label, short
    if (kind === 'week') {
      start = startOfWeek(today)
      start.setUTCDate(start.getUTCDate() - 7 * i)
      end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 7)
      const last = new Date(end)
      last.setUTCDate(last.getUTCDate() - 1)
      label = `${ddmm(start)} – ${ddmm(last)}${last.getUTCFullYear()}`
      short = ddmm(start)
    } else {
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
      end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
      label = `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`
      short = MONTHS[start.getUTCMonth()]
    }
    const inside = receipts.filter((r) => r.d >= start && r.d < end)
    periods.push({
      key: start.toISOString().slice(0, 10),
      label,
      short,
      receipts: inside,
      count: inside.length,
      total: Math.round(inside.reduce((s, r) => s + r.total, 0) * 100) / 100,
    })
  }
  return periods
}

function sumBy(receipts, keyOf, valueOf) {
  const totals = {}
  for (const r of receipts) {
    for (const [k, v] of keyOf(r)) totals[k] = (totals[k] ?? 0) + valueOf(v)
  }
  return Object.entries(totals)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
}

export default function ExpensesPage() {
  const [kind, setKind] = useState('week')
  const [receipts, setReceipts] = useState(null)
  const [error, setError] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    api
      .expenses()
      .then((data) => setReceipts(data.receipts.map((r) => ({ ...r, d: new Date(r.date) }))))
      .catch((err) => setError(err.message))
  }, [])

  // Flip a receipt between public and private; update the list right away, undo if the server says no
  async function changeVisibility(id, isPublic) {
    const apply = (v) => setReceipts((list) => list.map((r) => (r.id === id ? { ...r, isPublic: v } : r)))
    apply(isPublic)
    try {
      await api.setReceiptVisibility(id, isPublic)
    } catch (err) {
      apply(!isPublic)
      setError(err.message)
    }
  }

  const periods = useMemo(() => (receipts ? buildPeriods(kind, receipts) : []), [kind, receipts])
  const current = periods[periods.length - 1]
  const selected = periods.find((p) => p.key === selectedKey) ?? current
  const activePeriods = periods.filter((p) => p.count > 0)
  const average = activePeriods.length ? activePeriods.reduce((s, p) => s + p.total, 0) / activePeriods.length : 0

  const byCategory = selected ? sumBy(selected.receipts, (r) => Object.entries(r.categories), (v) => v) : []
  const byStore = selected ? sumBy(selected.receipts, (r) => [[r.chain, r.total]], (v) => v) : []

  const toggle = (active) => `px-3 py-1 rounded-md text-sm ${active ? 'bg-slate-800 text-white' : 'text-slate-700'}`
  const word = kind === 'week' ? 'week' : 'month'

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold">Expenses</h2>
          <Link to="/receipts" className="text-sm text-slate-500 underline">All my receipts · edit</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
            <button className={toggle(kind === 'week')} onClick={() => { setKind('week'); setSelectedKey(null) }}>Weekly</button>
            <button className={toggle(kind === 'month')} onClick={() => { setKind('month'); setSelectedKey(null) }}>Monthly</button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!receipts && !error && <p className="text-slate-500">Loading…</p>}

      {receipts && receipts.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          <p className="text-slate-600">You have no receipts yet. Receipts you scan show up here.</p>
          <div className="mt-3 flex justify-center">
            <Link to="/upload" className="rounded-lg bg-emerald-600 text-on-accent px-4 py-2 font-medium">Scan receipt</Link>
          </div>
        </div>
      )}

      {receipts && receipts.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={`This ${word}`} value={euro(current.total)} note={`${current.count} receipts`} />
            <Stat label={`Last ${word}`} value={euro(periods[periods.length - 2]?.total ?? 0)} note={`${periods[periods.length - 2]?.count ?? 0} receipts`} />
            <Stat label={`Avg per ${word}`} value={euro(average)} note={`over ${activePeriods.length} active ${word}s`} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-sm text-slate-500 mb-1">
              Spending per {word}, last {PERIOD_COUNT[kind]} {word}s · tap a bar for details
            </p>
            <SpendChart periods={periods} selectedKey={selected?.key} onSelect={setSelectedKey} />
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-slate-500">Show as table</summary>
              <table className="mt-2 w-full">
                <tbody>
                  {[...periods].reverse().map((p) => (
                    <tr key={p.key} className="border-t border-slate-100">
                      <td className="py-1">{p.label}</td>
                      <td className="text-right text-slate-500">{p.count} receipts</td>
                      <td className="text-right font-medium">{euro(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>

          {selected && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold">{selected.label}</h3>
                <p className="font-bold">{euro(selected.total)}</p>
              </div>

              {selected.count === 0 ? (
                <p className="text-slate-500 text-sm">No receipts in this {word}.</p>
              ) : (
                <>
                  <Breakdown title="By category" rows={byCategory} icon={(name) => categoryIcon(name)} order={CATEGORIES.map((c) => c.name)} />
                  <Breakdown title="By store" rows={byStore} />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 mb-1">Receipts</h4>
                    <ul className="text-sm divide-y divide-slate-100">
                      {selected.receipts.map((r) => (
                        <li key={r.id} className="flex justify-between items-center gap-2 py-1">
                          <span>
                            <Link to={`/receipts/${r.id}`} className="hover:underline">
                              {formatDate(r.date)} · {r.chain} <span className="text-slate-400">({r.itemCount} items) ✏️</span>
                            </Link>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <ShareToggle compact isPublic={r.isPublic} onChange={(v) => changeVisibility(r.id, v)} />
                            <span className="font-medium">{euro(r.total)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-slate-400">
                    Totals are what you paid. Category amounts are the product lines, so they leave out deposit (Pfand).
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Stat({ label, value, note }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  )
}

// Horizontal bars, one hue: longer bar = more money
function Breakdown({ title, rows, icon }) {
  const max = Math.max(...rows.map((r) => r.amount), 1)
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-500 mb-1">{title}</h4>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="text-sm">
            <div className="flex justify-between">
              <span>{icon ? `${icon(r.name)} ` : ''}{r.name}</span>
              <span className="font-medium">{euro(r.amount)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 mt-0.5">
              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(r.amount / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
