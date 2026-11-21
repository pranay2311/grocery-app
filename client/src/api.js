// Small wrapper around fetch for our Express API.
// In production set VITE_API_URL to the backend address (e.g. https://api.example.com).
const BASE = import.meta.env.VITE_API_URL || ''
const SESSION_KEY = 'session'

// Browser id from before accounts existed; sent at login so older receipts from this browser move to the account
function guestId() {
  try {
    let id = localStorage.getItem('guestId')
    if (!id) {
      // crypto.randomUUID only exists on https/localhost; phones on http://192.168.x.x need the fallback
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('guestId', id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

// --- login session (token + username), kept in this browser ---
export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) ?? null
  } catch {
    return null
  }
}
export function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage blocked: the user stays logged in until the page is reloaded
  }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

async function request(path, options = {}) {
  const token = loadSession()?.token
  const headers = {
    ...options.headers,
    'X-Guest-Id': guestId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && token) onUnauthorized() // token expired or invalid -> back to login
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

const postJson = (path, body) =>
  request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  checkUsername: (username) => postJson('/auth/check', { username }),
  login: (username, password) => postJson('/auth/login', { username, password }),
  register: (username, password) => postJson('/auth/register', { username, password }),
  scanReceipt(file) {
    const form = new FormData()
    form.append('receipt', file)
    return request('/receipts/scan', { method: 'POST', body: form })
  },
  saveReceipt: (receipt) => postJson('/receipts', receipt),
  myReceipts: () => request('/receipts/mine'),
  getReceipt: (id) => request(`/receipts/${id}`),
  updateReceipt: (id, receipt) =>
    request(`/receipts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(receipt) }),
  deleteReceipt: (id) => request(`/receipts/${id}`, { method: 'DELETE' }),
  shoppingList: () => request('/shopping-list'),
  addToList: (productId) => postJson('/shopping-list', { productId }),
  updateListItem: (id, changes) =>
    request(`/shopping-list/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }),
  removeListItem: (id) => request(`/shopping-list/${id}`, { method: 'DELETE' }),
  clearCheckedItems: () => request('/shopping-list/checked', { method: 'DELETE' }),
  setReceiptVisibility: (id, isPublic) =>
    request(`/receipts/${id}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic }),
    }),
  expenses: () => request('/expenses'),
  listProducts: () => request('/products'),
  productPrices: (id, groupBy = 'chain') => request(`/products/${id}/prices?groupBy=${groupBy}`),
}
