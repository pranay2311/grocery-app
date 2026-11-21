import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import Product from '../models/Product.js'
import ShoppingListItem from '../models/ShoppingListItem.js'
import { resolveProduct } from '../services/productMatching.js'
import { latestPrices } from '../services/priceQueries.js'

const router = Router()
const round = (n) => Math.round(n * 100) / 100

// GET /api/shopping-list – the list plus what it would cost at each chain
router.get('/', async (req, res) => {
  const items = await ShoppingListItem.find({ user: req.user.id }).populate('product').sort({ checked: 1, createdAt: 1 }).lean()

  // Latest price of every list product at every chain the user can see
  const productIds = items.map((i) => i.product._id)
  const prices = productIds.length ? await latestPrices(productIds, 'chain', req.user.id) : []
  const byProduct = new Map()
  for (const p of prices) {
    const key = String(p.productId)
    if (!byProduct.has(key)) byProduct.set(key, [])
    byProduct.get(key).push(p)
  }

  // Estimated cost of an item = last price paid for one pack/line there × quantity
  const listItems = items.map((i) => {
    const options = (byProduct.get(String(i.product._id)) ?? []).map((p) => ({
      chain: p.storeLabel,
      cost: round(p.price * i.quantity),
      lastSeen: p.lastSeen,
    }))
    options.sort((a, b) => a.cost - b.cost)
    return {
      id: i._id,
      productId: i.product._id,
      name: i.product.name,
      nameEn: i.product.nameEn ?? '',
      icon: i.product.icon ?? '',
      category: i.product.category ?? '',
      quantity: i.quantity,
      checked: i.checked,
      cheapest: options[0] ?? null,
      options,
    }
  })

  // Per chain: how many list items it has a price for and their total
  const open = listItems.filter((i) => !i.checked)
  const chains = new Map()
  for (const item of open) {
    for (const o of item.options) {
      const c = chains.get(o.chain) ?? { chain: o.chain, total: 0, found: 0 }
      c.total += o.cost
      c.found += 1
      chains.set(o.chain, c)
    }
  }
  const stores = [...chains.values()]
    .map((c) => ({ ...c, total: round(c.total), missing: open.length - c.found }))
    // stores that have everything first, then cheapest
    .sort((a, b) => a.missing - b.missing || a.total - b.total)

  // Cheapest possible if each item is bought wherever it is cheapest
  const priced = open.filter((i) => i.cheapest)
  const split = {
    total: round(priced.reduce((s, i) => s + i.cheapest.cost, 0)),
    found: priced.length,
    missing: open.length - priced.length,
  }

  res.json({ items: listItems, stores, split, openCount: open.length })
})

// POST /api/shopping-list { productId } – add a product (or one more of it)
router.post('/', async (req, res) => {
  const { productId } = z.object({ productId: z.string() }).parse(req.body)
  if (!mongoose.isValidObjectId(productId)) return res.status(404).json({ error: 'Product not found' })
  const product = await resolveProduct(await Product.findById(productId))
  if (!product) return res.status(404).json({ error: 'Product not found' })

  const existing = await ShoppingListItem.findOne({ user: req.user.id, product: product._id })
  if (existing) {
    // Already on the list: unticked again if it was done, otherwise one more
    if (existing.checked) existing.checked = false
    else existing.quantity += 1
    await existing.save()
    return res.json({ id: existing._id, quantity: existing.quantity })
  }
  const item = await ShoppingListItem.create({ user: req.user.id, product: product._id })
  res.status(201).json({ id: item._id, quantity: item.quantity })
})

// PATCH /api/shopping-list/:id { quantity?, checked? }
router.patch('/:id', async (req, res) => {
  const changes = z.object({ quantity: z.number().int().min(1).max(99).optional(), checked: z.boolean().optional() }).parse(req.body)
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not on your list' })
  const item = await ShoppingListItem.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: changes }, { returnDocument: 'after' })
  if (!item) return res.status(404).json({ error: 'Not on your list' })
  res.json({ id: item._id, quantity: item.quantity, checked: item.checked })
})

// DELETE /api/shopping-list/checked – remove everything already ticked off
router.delete('/checked', async (req, res) => {
  const r = await ShoppingListItem.deleteMany({ user: req.user.id, checked: true })
  res.json({ removed: r.deletedCount })
})

// DELETE /api/shopping-list/:id
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not on your list' })
  await ShoppingListItem.deleteOne({ _id: req.params.id, user: req.user.id })
  res.json({ removed: true })
})

export default router
