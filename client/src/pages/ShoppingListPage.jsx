import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import ProductIcon from '../components/ProductIcon.jsx'
import { euro } from '../format.js'

export default function ShoppingListPage() {
  const [data, setData] = useState(null)
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    api
      .shoppingList()
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    reload()
    api.listProducts().then((d) => setProducts(d.products)).catch(() => {})
  }, [reload])

  // Run a change, then refresh totals; show the error instead of failing silently
  const act = (promise) => promise.then(reload).catch((err) => setError(err.message))

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q)).slice(0, 8)
  }, [query, products])

  function add(productId) {
    setQuery('')
    act(api.addToList(productId))
  }

  if (error) return <p className="text-red-600">{error}</p>
  if (!data) return <p className="text-slate-500">Loading…</p>

  const best = data.stores[0]
  const checkedCount = data.items.length - data.openCount

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Shopping list</h2>

      {/* Add products */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a product, e.g. Milch or bananas…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button onClick={() => add(p.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                  <ProductIcon icon={p.icon} category={p.category} size={24} />
                  <span className="flex-1">
                    {p.name} <span className="text-slate-500 text-sm">· {p.nameEn}</span>
                  </span>
                  <span className="text-sm text-slate-500">from {euro(p.bestPrice)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.items.length === 0 && (
        <p className="text-slate-500">Your list is empty. Search above, or tap “+ List” on any product.</p>
      )}

      {/* Where to shop */}
      {data.openCount > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-semibold">Where is it cheapest?</h3>
          {data.stores.length === 0 ? (
            <p className="text-sm text-slate-500">No prices known yet for these products.</p>
          ) : (
            <>
              {best && best.missing === 0 && (
                <p className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-800">
                  🏆 Shop at <b>{best.chain}</b>: about <b>{euro(best.total)}</b> for everything.
                </p>
              )}
              <ul className="space-y-1 text-sm">
                {data.stores.map((s, i) => (
                  <li key={s.chain} className="flex justify-between gap-2">
                    <span className={i === 0 && s.missing === 0 ? 'font-medium text-emerald-700' : ''}>
                      {s.chain}
                      {s.missing > 0 && (
                        <span className="text-slate-500"> · {s.found} of {data.openCount} items known</span>
                      )}
                    </span>
                    <span className="font-medium">{euro(s.total)}</span>
                  </li>
                ))}
              </ul>
              {data.split.found > 1 && (
                <p className="text-sm text-slate-600 border-t border-slate-100 pt-2">
                  Buying each item where it is cheapest: <b>{euro(data.split.total)}</b>
                  {data.split.missing > 0 && ` (${data.split.missing} item${data.split.missing > 1 ? 's' : ''} without a price)`}
                </p>
              )}
              <p className="text-xs text-slate-400">Estimates from the latest prices people paid, per pack or usual amount.</p>
            </>
          )}
        </div>
      )}

      {/* The list */}
      {data.items.length > 0 && (
        <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {data.items.map((item) => (
            <li key={item.id} className={`flex items-center gap-3 p-3 ${item.checked ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => act(api.updateListItem(item.id, { checked: e.target.checked }))}
                className="w-5 h-5 accent-emerald-600"
                aria-label={`Got ${item.name}`}
              />
              <ProductIcon icon={item.icon} category={item.category} size={28} />
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${item.checked ? 'line-through' : ''}`}>{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.nameEn}
                  {item.cheapest ? ` · cheapest at ${item.cheapest.chain} ${euro(item.cheapest.cost)}` : ' · no price yet'}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => (item.quantity > 1 ? act(api.updateListItem(item.id, { quantity: item.quantity - 1 })) : act(api.removeListItem(item.id)))}
                  className="w-7 h-7 rounded border border-slate-300"
                  aria-label={item.quantity > 1 ? 'One less' : 'Remove'}
                >
                  {item.quantity > 1 ? '−' : '🗑'}
                </button>
                <span className="w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => act(api.updateListItem(item.id, { quantity: item.quantity + 1 }))}
                  className="w-7 h-7 rounded border border-slate-300"
                  aria-label="One more"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {checkedCount > 0 && (
        <button onClick={() => act(api.clearCheckedItems())} className="text-sm text-slate-500 underline">
          Remove {checkedCount} ticked item{checkedCount > 1 ? 's' : ''}
        </button>
      )}
    </section>
  )
}
