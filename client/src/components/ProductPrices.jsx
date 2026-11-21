import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { euro, formatDate, unitLabel } from '../format.js'

// All stores' current prices for one product, shown when a product card is opened.
export default function ProductPrices({ productId }) {
  const [groupBy, setGroupBy] = useState('chain')
  const [prices, setPrices] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setPrices(null)
    api
      .productPrices(productId, groupBy)
      .then((data) => !cancelled && setPrices(data.prices))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [productId, groupBy])

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex gap-1 mb-2 text-xs">
        {['chain', 'branch'].map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            className={`px-2 py-1 rounded ${groupBy === g ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {g === 'chain' ? 'Per chain' : 'Per branch'}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!prices && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {prices && (
        <ul className="space-y-1">
          {prices.map((p, i) => (
            <li key={p.key} className="flex justify-between text-sm">
              <span className={i === 0 ? 'font-medium text-emerald-700' : ''}>
                {p.storeLabel} <span className="text-slate-400">· {formatDate(p.lastSeen)}</span>
              </span>
              <span className={i === 0 ? 'font-bold text-emerald-700' : ''}>
                {euro(p.price)}
                {p.unit !== 'piece' && (
                  <span className="text-xs text-slate-500 font-normal"> ({euro(p.unitPrice)}/{unitLabel[p.unit]})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
