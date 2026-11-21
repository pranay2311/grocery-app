import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { ZodError } from 'zod'
import { connectDb } from './db.js'
import receiptsRouter from './routes/receipts.js'
import pricesRouter from './routes/prices.js'
import productsRouter from './routes/products.js'
import expensesRouter from './routes/expenses.js'
import authRouter from './routes/auth.js'
import shoppingListRouter from './routes/shoppingList.js'
import { optionalAuth, requireAuth } from './services/auth.js'

const app = express()
const PORT = process.env.PORT || 5000
const isProduction = process.env.NODE_ENV === 'production'

// Behind the host's proxy (Render, Caddy...): use the real visitor IP for rate limits
app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // product icons come from jsDelivr; receipt previews are local blob: images
        'img-src': ["'self'", 'data:', 'blob:', 'https://cdn.jsdelivr.net'],
      },
    },
  }),
)
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)

// Everything below needs a logged-in user
app.use('/api/receipts', requireAuth, receiptsRouter)
app.use('/api/prices', requireAuth, pricesRouter)
app.use('/api/products', optionalAuth, productsRouter) // visitors may browse prices
app.use('/api/expenses', requireAuth, expensesRouter)
app.use('/api/shopping-list', requireAuth, shoppingListRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// In production this one server also serves the built React app (client/dist)
if (isProduction) {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  app.use(express.static(dist, { maxAge: '1h', index: false }))
  // Any other path is a page of the app (React Router handles it)
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

// Express 5 forwards errors from async handlers here automatically.
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid data', details: err.issues })
  console.error(err)
  const status = err.status || 500
  // Don't show internal error details to visitors in production
  res.status(status).json({ error: status < 500 || !isProduction ? err.message || 'Something went wrong' : 'Something went wrong' })
})

connectDb(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
