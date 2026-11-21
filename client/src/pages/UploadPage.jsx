import { useState } from 'react'
import { api } from '../api.js'
import ReceiptReview from '../components/ReceiptReview.jsx'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [status, setStatus] = useState('idle') // idle | scanning | review | saving | saved
  const [error, setError] = useState('')

  function onPick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setReceipt(null)
    setStatus('idle')
    setError('')
  }

  async function onScan() {
    setStatus('scanning')
    setError('')
    try {
      const data = await api.scanReceipt(file)
      setReceipt(data.receipt)
      setStatus('review')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  async function onSave(edited) {
    setStatus('saving')
    setError('')
    try {
      await api.saveReceipt(edited)
      setStatus('saved')
    } catch (err) {
      setError(err.message)
      setStatus('review')
    }
  }

  return (
    <section className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-medium mb-2">Photo of your receipt (Kassenbon)</label>
        <p className="text-xs text-slate-500 mb-2">
          The photo is read by an AI service and then discarded. Please fold or cover card numbers and your name before taking the photo.
        </p>
        <input type="file" accept="image/*" capture="environment" onChange={onPick} />
        {preview && <img src={preview} alt="Receipt preview" className="mt-4 max-h-80 rounded-lg border" />}
        {file && status === 'idle' && (
          <button onClick={onScan} className="mt-4 rounded-lg bg-emerald-600 text-on-accent px-4 py-2 font-medium">
            Read receipt
          </button>
        )}
        {status === 'scanning' && <p className="mt-4 text-slate-600">Reading receipt… this takes a few seconds.</p>}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {receipt && (status === 'review' || status === 'saving') && (
        <ReceiptReview initial={receipt} onSave={onSave} saving={status === 'saving'} />
      )}

      {status === 'saved' && (
        <p className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
          Saved! Thanks for adding prices.
        </p>
      )}
    </section>
  )
}
