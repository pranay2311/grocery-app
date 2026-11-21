import { useState } from 'react'
import ProductIcon from './ProductIcon.jsx'
import ShareToggle from './ShareToggle.jsx'

const input = 'w-full rounded border border-slate-300 px-2 py-1 text-sm'

// Same names the AI is asked to use, so one chain isn't saved under two spellings
const KNOWN_CHAINS = ['Aldi Nord', 'Aldi Süd', 'Lidl', 'REWE', 'Edeka', 'Netto Marken-Discount', 'Netto', 'Penny', 'Kaufland', 'Norma', 'Globus', 'dm', 'Rossmann']

// Lets the user correct what the AI read before anything is saved.
export default function ReceiptReview({ initial, onSave, saving, saveLabel = 'Save prices', children }) {
  const [r, setR] = useState({ isPublic: true, ...initial })

  const setStore = (field, value) => setR({ ...r, store: { ...r.store, [field]: value } })
  const setItem = (i, field, value) =>
    setR({ ...r, items: r.items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)) })
  // eslint-disable-next-line no-unused-vars
  const unmatch = (i) => setR({ ...r, items: r.items.map((it, idx) => (idx === i ? (({ productId, matchedName, ...rest }) => rest)(it) : it)) })
  const removeItem = (i) => setR({ ...r, items: r.items.filter((_, idx) => idx !== i) })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <h2 className="font-semibold">Check the details</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-sm">Chain
          <input className={input} list="chains" value={r.store.chain} onChange={(e) => setStore('chain', e.target.value)} />
          <datalist id="chains">
            {KNOWN_CHAINS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="text-sm">City
          <input className={input} value={r.store.city ?? ''} onChange={(e) => setStore('city', e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">Address
          <input className={input} value={r.store.address ?? ''} onChange={(e) => setStore('address', e.target.value)} />
        </label>
        <label className="text-sm">Date
          <input type="date" className={input} value={r.date ?? ''} onChange={(e) => setR({ ...r, date: e.target.value })} />
        </label>
        <label className="text-sm">Total (€)
          <input type="number" step="0.01" className={input} value={r.total ?? ''} onChange={(e) => setR({ ...r, total: Number(e.target.value) })} />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">On receipt</th>
              <th>Product name (German / English)</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Price €</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {r.items.map((it, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1 pr-2 font-mono text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <ProductIcon icon={it.icon} category={it.category} size={24} />
                    {it.rawName}
                  </div>
                </td>
                <td className="pr-2">
                  {it.productId ? (
                    // Matched to a product already in the database: prices get compared with it
                    <div className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-sm">
                      <span className="text-emerald-800">✓ {it.matchedName}</span>
                      <button onClick={() => unmatch(i)} className="ml-2 text-xs text-slate-500 underline">
                        not the same
                      </button>
                    </div>
                  ) : (
                    <>
                      <input className={input} value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
                      <input
                        className={`${input} mt-1 text-slate-600`}
                        placeholder="English name"
                        value={it.nameEn ?? ''}
                        onChange={(e) => setItem(i, 'nameEn', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-0.5">New product</p>
                    </>
                  )}
                </td>
                <td className="pr-2 w-20">
                  <input type="number" step="0.001" className={input} value={it.quantity} onChange={(e) => setItem(i, 'quantity', Number(e.target.value))} />
                </td>
                <td className="pr-2 w-24">
                  <select className={input} value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)}>
                    <option value="piece">Stück</option>
                    <option value="kg">kg</option>
                    <option value="l">L</option>
                  </select>
                </td>
                <td className="pr-2 w-24">
                  <input type="number" step="0.01" className={input} value={it.totalPrice} onChange={(e) => setItem(i, 'totalPrice', Number(e.target.value))} />
                </td>
                <td>
                  <button onClick={() => removeItem(i)} className="text-red-500 text-xs">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ShareToggle isPublic={r.isPublic} onChange={(isPublic) => setR({ ...r, isPublic })} />

      <div className="flex flex-wrap items-center gap-3">
      <button onClick={() => onSave(r)} disabled={saving} className="rounded-lg bg-emerald-600 text-on-accent px-4 py-2 font-medium">
        {saving ? 'Saving…' : saveLabel}
      </button>
      {children}
      </div>
    </div>
  )
}
