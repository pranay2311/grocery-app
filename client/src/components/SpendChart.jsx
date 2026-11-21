import { useState } from 'react'
import { euro } from '../format.js'

// Single-series bar chart of spend per period. Hover shows the exact amount, click selects a period.
export default function SpendChart({ periods, selectedKey, onSelect }) {
  const [hover, setHover] = useState(null)
  const W = 640
  const H = 220
  const pad = { top: 16, right: 8, bottom: 28, left: 44 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  const max = Math.max(...periods.map((p) => p.total), 1)
  const step = niceStep(max / 4)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const slot = plotW / periods.length
  const barW = Math.min(28, slot * 0.6)
  const y = (v) => pad.top + plotH - (v / top) * plotH

  const hovered = periods.find((p) => p.key === hover)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Spending per period">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-slate-200)" strokeWidth="1" />
            <text x={pad.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--color-slate-500)">
              {t}€
            </text>
          </g>
        ))}
        {periods.map((p, i) => {
          const cx = pad.left + slot * i + slot / 2
          const h = Math.max(0, pad.top + plotH - y(p.total))
          const selected = p.key === selectedKey
          const showLabel = periods.length <= 12 || i % 2 === periods.length % 2
          return (
            <g key={p.key}>
              {h > 0 && (
                <path
                  d={roundedTopBar(cx - barW / 2, y(p.total), barW, h, Math.min(4, h))}
                  fill={selected ? 'var(--color-emerald-700)' : 'var(--color-emerald-300)'}
                />
              )}
              {showLabel && (
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill={selected ? 'var(--color-slate-900)' : 'var(--color-slate-500)'} fontWeight={selected ? 600 : 400}>
                  {p.short}
                </text>
              )}
              {/* Hit area larger than the bar, so thin bars are easy to hover and tap */}
              <rect
                x={pad.left + slot * i}
                y={pad.top}
                width={slot}
                height={plotH + pad.bottom}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(p.key)}
              >
                <title>{`${p.label}: ${euro(p.total)}`}</title>
              </rect>
            </g>
          )
        })}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="var(--color-slate-400)" strokeWidth="1" />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-slate-900 text-white text-xs px-2 py-1 shadow"
          style={{
            left: `${((pad.left + slot * periods.indexOf(hovered) + slot / 2) / W) * 100}%`,
            top: `${(Math.max(y(hovered.total) - 34, 0) / H) * 100}%`,
          }}
        >
          <p className="font-medium">{hovered.label}</p>
          <p>
            {euro(hovered.total)} · {hovered.count} {hovered.count === 1 ? 'receipt' : 'receipts'}
          </p>
        </div>
      )}
    </div>
  )
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow
}

// Bar anchored to the baseline with only its top corners rounded
function roundedTopBar(x, y, w, h, r) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}
