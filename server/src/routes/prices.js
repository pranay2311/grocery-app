import { Router } from 'express'
import Product from '../models/Product.js'
import { escapeRegex } from '../services/normalize.js'
import { latestPrices } from '../services/priceQueries.js'

const router = Router()

// GET /api/prices/search?q=milch&groupBy=chain|branch
// Returns the latest price per product per chain (or branch), cheapest first.
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  const groupBy = req.query.groupBy === 'branch' ? 'branch' : 'chain'
  if (q.length < 2) return res.status(400).json({ error: 'Type at least 2 characters' })

  const pattern = new RegExp(escapeRegex(q), 'i')
  const products = await Product.find({ mergedInto: null, $or: [{ name: pattern }, { nameEn: pattern }, { aliases: pattern }] }).limit(50).select('_id')
  if (products.length === 0) return res.json({ results: [] })

  res.json({ results: await latestPrices(products.map((p) => p._id), groupBy, req.user.id) })
})

export default router
