import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import Price from '../models/Price.js'
import Receipt from '../models/Receipt.js'
import { findOrCreateProduct, findOrCreateStore } from '../services/normalize.js'
import { parseReceiptImage } from '../services/receiptParser.js'

const router = Router()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const upload = multer({
  storage: multer.memoryStorage(), // we don't keep the photo, only the extracted data
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_TYPES.includes(file.mimetype)),
})

// AI calls cost money, so limit scans per IP.
const scanLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, message: { error: 'Too many scans, try again later.' } })

// Step 1: photo -> structured receipt (nothing saved yet)
router.post('/scan', scanLimiter, upload.single('receipt'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please upload a JPG, PNG or WEBP image (max 5 MB).' })
  const receipt = await parseReceiptImage(req.file.buffer, req.file.mimetype)
  res.json({ receipt })
})

const SaveSchema = z.object({
  store: z.object({
    chain: z.string().min(1),
    address: z.string().optional().default(''),
    postcode: z.string().optional().default(''),
    city: z.string().optional().default(''),
  }),
  date: z.string().min(1),
  total: z.number().optional(),
  isPublic: z.boolean().optional().default(true),
  items: z
    .array(
      z.object({
        rawName: z.string().optional().default(''),
        name: z.string().min(1),
        nameEn: z.string().optional().default(''),
        icon: z.string().max(32).optional().default(''),
        productId: z.string().optional(), // existing product picked during review
        category: z.string().optional().default(''),
        quantity: z.number().positive(),
        unit: z.enum(['piece', 'kg', 'l']),
        totalPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
})

// Creates the price lines (and products) for a receipt's items
async function writeItems(receipt, items, store) {
  const prices = []
  for (const item of items) {
    const product = await findOrCreateProduct(item)
    prices.push({
      product: product._id,
      store: store._id,
      receipt: receipt._id,
      user: receipt.user,
      isPublic: receipt.isPublic,
      date: receipt.date,
      rawName: item.rawName,
      quantity: item.quantity,
      unit: item.unit,
      totalPrice: item.totalPrice,
      unitPrice: Math.round((item.totalPrice / item.quantity) * 100) / 100,
    })
  }
  await Price.insertMany(prices)
  return prices.length
}

function parseDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// Step 2: user reviewed the data -> save store, receipt, products and prices
router.post('/', async (req, res) => {
  const data = SaveSchema.parse(req.body)
  const date = parseDate(data.date)
  if (!date) return res.status(400).json({ error: 'Invalid date' })

  // Same user, date, total and number of items: almost certainly the same receipt scanned again
  if (data.total > 0) {
    const duplicate = await Receipt.exists({ user: req.user.id, date, total: data.total, itemCount: data.items.length })
    if (duplicate) return res.status(409).json({ error: 'This receipt was already saved.' })
  }

  const store = await findOrCreateStore(data.store)
  const receipt = await Receipt.create({
    store: store._id,
    date,
    total: data.total,
    user: req.user.id,
    guestId: req.get('X-Guest-Id'),
    itemCount: data.items.length,
    isPublic: data.isPublic,
  })
  const saved = await writeItems(receipt, data.items, store)
  res.status(201).json({ receiptId: receipt._id, saved })
})

// --- the owner's own receipts: list, open, edit, delete ---

async function ownReceipt(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Receipt not found' })
    return null
  }
  const receipt = await Receipt.findOne({ _id: req.params.id, user: req.user.id })
  if (!receipt) res.status(404).json({ error: 'Receipt not found' })
  return receipt
}

// GET /api/receipts/mine – all of the user's receipts, newest first
router.get('/mine', async (req, res) => {
  const receipts = await Receipt.find({ user: req.user.id }).populate('store', 'chain city').sort({ date: -1 }).lean()
  res.json({
    receipts: receipts.map((r) => ({
      id: r._id,
      date: r.date,
      total: r.total ?? 0,
      chain: r.store?.chain ?? 'Unknown',
      city: r.store?.city ?? '',
      itemCount: r.itemCount,
      isPublic: r.isPublic !== false,
    })),
  })
})

// GET /api/receipts/:id – one receipt in the same shape the review screen uses
router.get('/:id', async (req, res) => {
  const receipt = await ownReceipt(req, res)
  if (!receipt) return
  await receipt.populate('store')
  const prices = await Price.find({ receipt: receipt._id }).populate('product').sort({ _id: 1 }).lean()
  res.json({
    receipt: {
      id: receipt._id,
      store: {
        chain: receipt.store?.chain ?? '',
        address: receipt.store?.address ?? '',
        postcode: receipt.store?.postcode ?? '',
        city: receipt.store?.city ?? '',
      },
      date: receipt.date.toISOString().slice(0, 10),
      total: receipt.total ?? 0,
      isPublic: receipt.isPublic !== false,
      items: prices.map((p) => ({
        rawName: p.rawName ?? '',
        name: p.product?.name ?? '',
        nameEn: p.product?.nameEn ?? '',
        icon: p.product?.icon ?? '',
        category: p.product?.category ?? '',
        quantity: p.quantity,
        unit: p.unit,
        totalPrice: p.totalPrice,
        productId: p.product ? String(p.product._id) : undefined,
        matchedName: p.product?.name,
      })),
    },
  })
})

// PUT /api/receipts/:id – save the edited receipt: header fields updated, item lines rewritten
router.put('/:id', async (req, res) => {
  const receipt = await ownReceipt(req, res)
  if (!receipt) return
  const data = SaveSchema.parse(req.body)
  const date = parseDate(data.date)
  if (!date) return res.status(400).json({ error: 'Invalid date' })

  const store = await findOrCreateStore(data.store)
  Object.assign(receipt, { store: store._id, date, total: data.total, isPublic: data.isPublic, itemCount: data.items.length })
  await receipt.save()
  await Price.deleteMany({ receipt: receipt._id })
  const saved = await writeItems(receipt, data.items, store)
  res.json({ receiptId: receipt._id, saved })
})

// DELETE /api/receipts/:id – remove the receipt and its prices
router.delete('/:id', async (req, res) => {
  const receipt = await ownReceipt(req, res)
  if (!receipt) return
  const prices = await Price.deleteMany({ receipt: receipt._id })
  await receipt.deleteOne()
  res.json({ deleted: true, prices: prices.deletedCount })
})

// Change who can see a receipt's prices. Only the owner can do this.
router.patch('/:id/visibility', async (req, res) => {
  const { isPublic } = z.object({ isPublic: z.boolean() }).parse(req.body)
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Receipt not found' })
  const receipt = await Receipt.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: { isPublic } })
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' })
  await Price.updateMany({ receipt: receipt._id }, { $set: { isPublic } })
  res.json({ id: receipt._id, isPublic })
})

export default router
