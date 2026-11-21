import { Router } from 'express'
import mongoose from 'mongoose'
import Price from '../models/Price.js'
import Product from '../models/Product.js'
import Receipt from '../models/Receipt.js'
import { latestPrices, productOverview } from '../services/priceQueries.js'

// Open to visitors too (optionalAuth): they see public prices only; req.user is null for them.
const router = Router()

// GET /api/products – every product with its cheapest current price,
// plus myLastBought: when the logged-in user last bought it (null if never / not logged in).
router.get('/', async (req, res) => {
  const userId = req.user?.id ?? null
  const products = await productOverview(userId)
  const lastBought = new Map()
  if (userId) {
    const myReceipts = await Receipt.find({ user: userId }).select('_id').lean()
    const myPurchases = await Price.aggregate([
      { $match: { receipt: { $in: myReceipts.map((r) => r._id) } } },
      { $group: { _id: '$product', last: { $max: '$date' } } },
    ])
    for (const p of myPurchases) lastBought.set(String(p._id), p.last)
  }
  res.json({ products: products.map((p) => ({ ...p, myLastBought: lastBought.get(String(p.id)) ?? null })) })
})

// GET /api/products/:id/prices?groupBy=chain|branch – all stores' prices for one product
router.get('/:id/prices', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Product not found' })
  const product = await Product.findById(req.params.id)
  if (!product) return res.status(404).json({ error: 'Product not found' })
  const groupBy = req.query.groupBy === 'branch' ? 'branch' : 'chain'
  res.json({
    product: { id: product._id, name: product.name, nameEn: product.nameEn },
    prices: await latestPrices([product._id], groupBy, req.user?.id ?? null),
  })
})

export default router
