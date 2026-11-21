import { useEffect, useState } from 'react'

// Theme choice: 'system' (follow the phone/PC setting), 'light' or 'dark'. Remembered per browser.
const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function readChoice() {
  try {
    return localStorage.getItem(KEY) || 'system'
  } catch {
    return 'system'
  }
}

function apply(choice) {
  const dark = choice === 'dark' || (choice === 'system' && media().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function useTheme() {
  const [choice, setChoice] = useState(readChoice)

  useEffect(() => {
    apply(choice)
    if (choice !== 'system') return
    // Follow the device live while on "system"
    const m = media()
    const onChange = () => apply('system')
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [choice])

  function cycle() {
    const next = { system: 'light', light: 'dark', dark: 'system' }[choice]
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage blocked: choice lasts until reload
    }
    setChoice(next)
  }

  return { choice, cycle }
}
