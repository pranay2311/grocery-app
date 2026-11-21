import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import ReceiptReview from '../components/ReceiptReview.jsx'

// Open a saved receipt, correct anything (date, prices, items, store), or delete it
export default function ReceiptEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    api
      .getReceipt(id)
      .then((d) => setReceipt(d.receipt))
      .catch((err) => setError(err.message))
  }, [id])

  async function onSave(edited) {
    setSaving(true)
    setError('')
    try {
      await api.updateReceipt(id, edited)
      navigate('/receipts')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function onDelete() {
    setSaving(true)
    try {
      await api.deleteReceipt(id)
      navigate('/receipts')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Edit receipt</h2>
        <Link to="/receipts" className="text-sm text-slate-500 underline">Back</Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!receipt && !error && <p className="text-slate-500">Loading…</p>}

      {receipt && (
        <ReceiptReview initial={receipt} onSave={onSave} saving={saving} saveLabel="Save changes">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-600 underline">
              Delete receipt
            </button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-red-600">Delete this receipt and its {receipt.items.length} prices for good?</span>
              <button type="button" onClick={onDelete} disabled={saving} className="rounded-lg bg-red-600 text-on-accent px-3 py-1.5">
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-slate-500 underline">
                Cancel
              </button>
            </span>
          )}
        </ReceiptReview>
      )}
    </section>
  )
}
