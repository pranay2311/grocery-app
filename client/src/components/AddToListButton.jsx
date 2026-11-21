import { useState } from 'react'
import { api } from '../api.js'

// Small "+" button on a product card that puts the product on the shopping list
export default function AddToListButton({ productId }) {
  const [state, setState] = useState('idle') // idle | busy | added | error

  async function add() {
    setState('busy')
    try {
      await api.addToList(productId)
      setState('added')
    } catch {
      setState('error')
    }
  }

  const label = { idle: '+ List', busy: '…', added: '✓ Added', error: 'Retry' }[state]
  return (
    <button
      onClick={add}
      disabled={state === 'busy' || state === 'added'}
      title="Add to shopping list"
      className={`shrink-0 text-xs px-2 py-1 rounded-lg border ${state === 'added' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-700'}`}
    >
      {label}
    </button>
  )
}
