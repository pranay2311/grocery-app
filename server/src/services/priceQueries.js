import mongoose from 'mongoose'
import Price from '../models/Price.js'

// Prices a viewer may see: everyone's public ones plus their own private ones (visitors: public only)
export function visibleTo(viewerId) {
  if (!viewerId) return { isPublic: { $ne: false } }
  return { $or: [{ isPublic: { $ne: false } }, { user: new mongoose.Types.ObjectId(String(viewerId)) }] }
}

// Pipeline stages that keep only the newest price per product and chain (or branch).
function latestPerStoreStages(groupBy) {
  return [
    { $lookup: { from: 'stores', localField: 'store', foreignField: '_id', as: 'store' } },
    { $unwind: '$store' },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: { product: '$product', where: groupBy === 'branch' ? '$store._id' : '$store.chainKey' },
        price: { $first: '$totalPrice' },
        unitPrice: { $first: '$unitPrice' },
        unit: { $first: '$unit' },
        lastSeen: { $first: '$date' },
        store: { $first: '$store' },
      },
    },
  ]
}

export function storeLabel(store, groupBy) {
  return groupBy === 'branch' ? [store.chain, store.address, store.city].filter(Boolean).join(', ') : store.chain
}

// Latest price at every chain/branch for the given products, cheapest per unit first.
export async function latestPrices(productIds, groupBy, viewerId) {
  const rows = await Price.aggregate([
    { $match: { product: { $in: productIds }, ...visibleTo(viewerId) } },
    ...latestPerStoreStages(groupBy),
    { $lookup: { from: 'products', localField: '_id.product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $sort: { unitPrice: 1 } },
    { $limit: 200 },
  ])
  return rows.map((r) => ({
    key: `${r._id.product}-${r._id.where}`,
    productId: r._id.product,
    productName: r.product.name,
    productNameEn: r.product.nameEn || '',
    price: r.price,
    unitPrice: r.unitPrice,
    unit: r.unit,
    lastSeen: r.lastSeen,
    storeLabel: storeLabel(r.store, groupBy),
  }))
}

// One row per product: its cheapest current price (compared across chains) and how many chains sell it.
export async function productOverview(viewerId) {
  const rows = await Price.aggregate([
    { $match: visibleTo(viewerId) },
    ...latestPerStoreStages('chain'),
    { $sort: { unitPrice: 1 } },
    {
      $group: {
        _id: '$_id.product',
        bestPrice: { $first: '$price' },
        bestUnitPrice: { $first: '$unitPrice' },
        unit: { $first: '$unit' },
        bestStore: { $first: '$store.chain' },
        storeCount: { $sum: 1 },
      },
    },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $sort: { 'product.name': 1 } },
    { $limit: 500 },
  ])
  return rows.map((r) => ({
    id: r._id,
    name: r.product.name,
    nameEn: r.product.nameEn || '',
    icon: r.product.icon || '',
    category: r.product.category || 'Sonstiges',
    bestPrice: r.bestPrice,
    bestUnitPrice: r.bestUnitPrice,
    unit: r.unit,
    bestStore: r.bestStore,
    storeCount: r.storeCount,
  }))
}
