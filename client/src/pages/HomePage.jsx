import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import AddToListButton from '../components/AddToListButton.jsx'
import ProductPrices from '../components/ProductPrices.jsx'
import ProductIcon from '../components/ProductIcon.jsx'
import { CATEGORIES, euro, unitLabel } from '../format.js'

const SORTS = [
  { id: 'category', label: '🗂️ By category' },
  { id: 'recent', label: '🕒 Recently bought' },
]

// Remember the chosen sort in this browser (falls back quietly if storage is blocked)
function savedSort() {
  try {
    return localStorage.getItem('homeSort') === 'recent' ? 'recent' : 'category'
  } catch {
    return 'category'
  }
}

// "2026-11-21..." -> "Today" / "Yesterday" / "Mo., 18.11.2026"
function dayLabel(dayKey) {
  const today = new Date()
  const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey === toKey(today)) return 'Today'
  if (dayKey === toKey(yesterday)) return 'Yesterday'
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function HomePage() {
  const { user } = useAuth()
  const [products, setProducts] = useState(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [sort, setSort] = useState(savedSort)

  useEffect(() => {
    api
      .listProducts()
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message))
  }, [user]) // reload after login/logout: own private prices and purchase dates change

  function changeSort(id) {
    setSort(id)
    try {
      localStorage.setItem('homeSort', id)
    } catch {
      // storage blocked: the choice just isn't remembered
    }
  }

  // Only show category chips that actually have products, with counts
  const counts = useMemo(() => {
    const c = {}
    for (const p of products ?? []) c[p.category] = (c[p.category] ?? 0) + 1
    return c
  }, [products])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products ?? []).filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q)),
    )
  }, [products, category, query])

  const activeSort = user ? sort : 'category' // recently bought needs an account
  const groups = useMemo(() => {
    if (activeSort === 'recent') {
      // Only what this user bought, newest purchase first, one section per day
      const mine = visible.filter((p) => p.myLastBought)
      const byDay = new Map()
      for (const p of mine.sort((a, b) => b.myLastBought.localeCompare(a.myLastBought) || a.name.localeCompare(b.name))) {
        const day = p.myLastBought.slice(0, 10)
        if (!byDay.has(day)) byDay.set(day, [])
        byDay.get(day).push(p)
      }
      return [...byDay].map(([day, items]) => ({ key: day, title: dayLabel(day), items }))
    }
    // Fixed category order, products A–Z inside each
    return CATEGORIES.map((c) => ({
      key: c.name,
      title: `${c.icon} ${c.name}`,
      items: visible.filter((p) => p.category === c.name),
    })).filter((g) => g.items.length > 0)
  }, [visible, activeSort])

  if (error) return <p className="text-red-600">{error}</p>
  if (!products) return <p className="text-slate-500">Loading products…</p>

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🧾</p>
        <p className="text-slate-600 mb-4">No prices yet. Scan your first receipt to get started!</p>
        <Link to={user ? '/upload' : '/login'} className="rounded-lg bg-emerald-600 text-on-accent px-4 py-2 font-medium">
          {user ? 'Scan receipt' : 'Log in to scan receipts'}
        </Link>
      </div>
    )
  }

  const chip = (active) =>
    `shrink-0 px-3 py-1.5 rounded-full text-sm border ${active ? 'bg-emerald-600 text-on-accent border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`

  return (
    <section>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${products.length} products (German or English)…`}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4">
        <button className={chip(category === 'all')} onClick={() => setCategory('all')}>
          All ({products.length})
        </button>
        {CATEGORIES.filter((c) => counts[c.name]).map((c) => (
          <button key={c.name} className={chip(category === c.name)} onClick={() => setCategory(c.name)}>
            {c.icon} {c.name} ({counts[c.name]})
          </button>
        ))}
      </div>

      {!user && (
        <p className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          Prices shared by our users. <Link to="/login" className="font-medium underline">Log in or sign up</Link> to scan your receipts, track spending and make a shopping list.
        </p>
      )}

      {user && (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Sort:</span>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => changeSort(s.id)}
              className={`px-3 py-1 rounded-md ${sort === s.id ? 'bg-slate-800 text-white' : 'text-slate-700'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {groups.length === 0 && (
        <p className="text-slate-500 mt-4">
          {query
            ? `No products match “${query}”.`
            : activeSort === 'recent'
              ? "You haven't bought anything yet. Scan a receipt and your purchases show up here."
              : 'No products in this category.'}
        </p>
      )}

      {groups.map((g) => (
        <div key={g.key} className="mt-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">{g.title}</h2>
          <ul className="space-y-2">
            {g.items.map((p) => (
              <li key={p.id} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                <button className="flex-1 min-w-0 flex items-center gap-3 text-left" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                  <ProductIcon icon={p.icon} category={p.category} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{p.name}</p>
                    {p.nameEn && <p className="text-sm text-slate-600">{p.nameEn}</p>}
                    <p className="text-xs text-slate-500">
                      Cheapest at {p.bestStore}
                      {p.storeCount > 1 && ` · ${p.storeCount} stores`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-700">{euro(p.bestPrice)}</p>
                    {p.unit !== 'piece' && <p className="text-xs text-slate-500">{euro(p.bestUnitPrice)}/{unitLabel[p.unit]}</p>}
                  </div>
                </button>
                {user && <AddToListButton productId={p.id} />}
                </div>
                {openId === p.id && <ProductPrices productId={p.id} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
