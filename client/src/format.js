export const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

export const unitLabel = { kg: 'kg', l: 'L', piece: 'Stück' }

export const formatDate = (d) => new Date(d).toLocaleDateString('de-DE')

// Same categories the AI uses when reading receipts
export const CATEGORIES = [
  { name: 'Obst & Gemüse', icon: '🥦' },
  { name: 'Milchprodukte', icon: '🥛' },
  { name: 'Fleisch & Fisch', icon: '🍗' },
  { name: 'Brot & Backwaren', icon: '🥖' },
  { name: 'Getränke', icon: '🧃' },
  { name: 'Tiefkühl', icon: '🧊' },
  { name: 'Vorrat', icon: '🥫' },
  { name: 'Süßes & Snacks', icon: '🍫' },
  { name: 'Drogerie', icon: '🧴' },
  { name: 'Haushalt', icon: '🧽' },
  { name: 'Sonstiges', icon: '🛒' },
]

export const categoryIcon = (name) => CATEGORIES.find((c) => c.name === name)?.icon ?? '🛒'
