// Switch between sharing a receipt's prices with everyone or keeping them to yourself.
export default function ShareToggle({ isPublic, onChange, disabled = false, compact = false }) {
  const option = (active) =>
    `flex-1 px-3 py-1.5 rounded-md text-sm text-left ${active ? 'bg-white shadow-sm ring-1 ring-slate-200 font-medium' : 'text-slate-600'}`

  if (compact) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!isPublic)}
        title={isPublic ? 'Prices shared with everyone. Tap to make private.' : 'Private. Tap to share prices with everyone.'}
        className={`text-xs px-2 py-0.5 rounded-full border ${isPublic ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-600 bg-slate-50'} disabled:opacity-50`}
      >
        {isPublic ? '🌍 Public' : '🔒 Private'}
      </button>
    )
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button type="button" className={option(isPublic)} onClick={() => onChange(true)}>
          🌍 Public
          <span className="block text-xs font-normal text-slate-500">Share prices to help others shop cheaper</span>
        </button>
        <button type="button" className={option(!isPublic)} onClick={() => onChange(false)}>
          🔒 Private
          <span className="block text-xs font-normal text-slate-500">Only you see these prices</span>
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1">
        Either way your expenses stay private. Others never see who shared a price. You can change this later on the Expenses page.
      </p>
    </div>
  )
}
