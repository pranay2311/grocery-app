import { useState } from 'react'
import { categoryIcon } from '../format.js'

// Google's emoji artwork (Noto), served from a pinned npm package so it looks the same on every phone.
const CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-google@16.0.0/img/google/64'

// "🍌" -> "1f34c"; with the variation selector kept or dropped (file names use either form)
function codepoints(emoji, keepFe0f) {
  return [...emoji]
    .map((c) => c.codePointAt(0).toString(16))
    .filter((cp) => keepFe0f || cp !== 'fe0f')
    .join('-')
}

export default function ProductIcon({ icon, category, size = 40 }) {
  const emoji = icon || categoryIcon(category)
  const sources = [`${CDN}/${codepoints(emoji, false)}.png`, `${CDN}/${codepoints(emoji, true)}.png`]
  const [attempt, setAttempt] = useState(0)

  const box = { width: size, height: size }
  return (
    <span className="shrink-0 grid place-items-center rounded-xl bg-slate-100" style={{ width: size + 12, height: size + 12 }}>
      {attempt < sources.length ? (
        <img
          src={sources[attempt]}
          alt=""
          loading="lazy"
          style={box}
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{emoji}</span>
      )}
    </span>
  )
}
