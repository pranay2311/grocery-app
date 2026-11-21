import { Router } from 'express'
import Price from '../models/Price.js'
import Receipt from '../models/Receipt.js'

const router = Router()

// GET /api/expenses
// The logged-in user's receipts of the last 2 years with paid total, store and spend per category.
// Private: only ever returns the caller's own receipts.
router.get('/', async (req, res) => {
  const since = new Date()
  since.setFullYear(since.getFullYear() - 2)

  const filter = { user: req.user.id, date: { $gte: since } }

  const receipts = await Receipt.find(filter).populate('store', 'chain city').sort({ date: -1 }).limit(2000).lean()
  if (receipts.length === 0) return res.json({ receipts: [] })

  // Spend per category for each receipt, from its saved item lines
  const lines = await Price.aggregate([
    { $match: { receipt: { $in: receipts.map((r) => r._id) } } },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    {
      $group: {
        _id: { receipt: '$receipt', category: { $ifNull: ['$product.category', 'Sonstiges'] } },
        amount: { $sum: '$totalPrice' },
      },
    },
  ])
  const categoriesByReceipt = new Map()
  for (const l of lines) {
    const key = String(l._id.receipt)
    if (!categoriesByReceipt.has(key)) categoriesByReceipt.set(key, {})
    categoriesByReceipt.get(key)[l._id.category || 'Sonstiges'] = Math.round(l.amount * 100) / 100
  }

  res.json({
    receipts: receipts.map((r) => {
      const categories = categoriesByReceipt.get(String(r._id)) ?? {}
      const itemsSum = Object.values(categories).reduce((a, b) => a + b, 0)
      return {
        id: r._id,
        date: r.date,
        // What was actually paid (includes deposit etc.); falls back to the items when no total was read
        total: r.total > 0 ? r.total : Math.round(itemsSum * 100) / 100,
        chain: r.store?.chain ?? 'Unknown',
        itemCount: r.itemCount,
        isPublic: r.isPublic !== false,
        categories,
      }
    }),
  })
})

export default router
