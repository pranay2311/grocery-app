import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import ExpensesPage from './pages/ExpensesPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ReceiptEditPage from './pages/ReceiptEditPage.jsx'
import ReceiptsPage from './pages/ReceiptsPage.jsx'
import ShoppingListPage from './pages/ShoppingListPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import { useTheme } from './theme.js'

const link = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-emerald-600 text-on-accent' : 'text-slate-700 hover:bg-slate-200'}`

const THEME_ICON = { system: '🖥️', light: '☀️', dark: '🌙' }
const THEME_NAME = { system: 'Theme: same as device', light: 'Theme: light', dark: 'Theme: dark' }

// Header + page frame used by every page except login
function Layout() {
  const { user, logout } = useAuth()
  const { choice, cycle } = useTheme()

  return (
    <>
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-emerald-700">🛒 Grocery Prices</h1>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" end className={link}>Products</NavLink>
            {user && (
              <>
                <NavLink to="/list" className={link}>🧾 List</NavLink>
                <NavLink to="/expenses" className={link}>Expenses</NavLink>
                <NavLink to="/upload" className={link}>📷 Scan</NavLink>
              </>
            )}
            <button onClick={cycle} className="px-2 py-2 rounded-lg hover:bg-slate-200" title={`${THEME_NAME[choice]} (tap to change)`} aria-label={THEME_NAME[choice]}>
              {THEME_ICON[choice]}
            </button>
            {user ? (
              <button onClick={logout} className="px-2 py-2 text-sm text-slate-500 hover:text-slate-800" title="Log out">
                👤 {user.username} · Log out
              </button>
            ) : (
              <Link to="/login" className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700">
                Log in / Sign up
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </>
  )
}

// Pages that need an account: not logged in -> login page, then back to where the user wanted to go
function RequireLogin() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export default function App() {
  useTheme() // keeps the theme applied on the login page too
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/login" element={<main className="px-4 py-6"><LoginPage /></main>} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route element={<RequireLogin />}>
            <Route path="/list" element={<ShoppingListPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/receipts/:id" element={<ReceiptEditPage />} />
            <Route path="/upload" element={<UploadPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
