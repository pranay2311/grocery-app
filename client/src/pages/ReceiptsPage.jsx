import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { euro, formatDate } from '../format.js'

// Every receipt of the logged-in user, with links to edit or delete
export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .myReceipts()
      .then((d) => setReceipts(d.receipts))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My receipts</h2>
        <Link to="/expenses" className="text-sm text-slate-500 underline">Back to expenses</Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!receipts && !error && <p className="text-slate-500">Loading…</p>}
      {receipts?.length === 0 && <p className="text-slate-500">No receipts yet.</p>}

      {receipts?.length > 0 && (
        <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {receipts.map((r) => (
            <li key={r.id}>
              <Link to={`/receipts/${r.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium">
                    {r.chain}
                    {r.city && <span className="text-slate-500 font-normal"> · {r.city}</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(r.date)} · {r.itemCount} items · {r.isPublic ? '🌍 Public' : '🔒 Private'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium">{euro(r.total)}</span>
                  <span className="text-slate-400">Edit ›</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
