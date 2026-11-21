import Product from '../models/Product.js'
import Store from '../models/Store.js'
import mongoose from 'mongoose'
import { resolveProduct } from './productMatching.js'
import { cleanIcon } from './receiptSchema.js'

// "Vollmilch 3,5%  1L" -> "vollmilch 3,5% 1l"; "Süd" -> "sud"
export function normalizeKey(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents/umlaut dots
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function findOrCreateStore({ chain, address = '', postcode = '', city = '' }) {
  const chainKey = normalizeKey(chain)
  const branchKey = [chainKey, normalizeKey(address), normalizeKey(postcode)].join('|')
  return Store.findOneAndUpdate(
    { branchKey },
    { $setOnInsert: { chain, chainKey, address, postcode, city, branchKey } },
    { upsert: true, returnDocument: 'after' },
  )
}

// Match a receipt line to a product: the product picked during review, then a known receipt
// spelling, then the cleaned-up name; otherwise create a new product. Merged products are followed.
export async function findOrCreateProduct({ productId, name, nameEn = '', icon = '', rawName, unit, category }) {
  const nameKey = normalizeKey(name)
  icon = cleanIcon(icon)
  let product =
    (productId && mongoose.isValidObjectId(productId) && (await Product.findById(productId))) ||
    (rawName && (await Product.findOne({ aliases: rawName, mergedInto: null }))) ||
    (await Product.findOne({ nameKey }))
  product = await resolveProduct(product)

  if (!product) {
    return Product.create({ name, nameEn, icon, nameKey, unit, category, aliases: rawName ? [rawName] : [] })
  }
  let changed = false
  if (icon && !product.icon) {
    product.icon = icon
    changed = true
  }
  if (rawName && !product.aliases.includes(rawName)) {
    product.aliases.push(rawName)
    changed = true
  }
  if (nameEn && !product.nameEn) {
    product.nameEn = nameEn
    changed = true
  }
  if (changed) await product.save()
  return product
}
