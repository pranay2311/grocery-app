// Finds duplicate products with the AI and merges them.
//   npm run merge            -> preview only, changes nothing
//   npm run merge -- --apply -> merge: prices move to the kept product, duplicates are hidden (not deleted)
//   npm run merge -- --undo  -> put every merged product and its prices back
import { GoogleGenAI } from '@google/genai'
import mongoose from 'mongoose'
import { z } from 'zod'
import { connectDb } from '../src/db.js'
import Price from '../src/models/Price.js'
import Product from '../src/models/Product.js'
import { SAME_PRODUCT_RULES } from '../src/services/productMatching.js'

const apply = process.argv.includes('--apply')
const undo = process.argv.includes('--undo')

await connectDb(process.env.MONGODB_URI)

if (undo) {
  const merged = await Product.find({ mergedInto: { $ne: null } })
  for (const p of merged) {
    const moved = await Price.updateMany({ mergedFrom: p._id }, { $set: { product: p._id }, $unset: { mergedFrom: 1 } })
    await Product.updateOne({ _id: p._id }, { $set: { mergedInto: null } })
    console.log(`restored ${p.name} (${moved.modifiedCount} prices)`)
  }
  await mongoose.disconnect()
  process.exit(0)
}

const GroupsSchema = z.object({
  groups: z.array(
    z.object({
      keep: z.number().int().describe('Number of the product to keep: the clearest, most generic name'),
      duplicates: z.array(z.number().int()).describe('Numbers of the other products that are the same product'),
    }),
  ),
})

const products = await Product.find({ mergedInto: null }).sort({ name: 1 }).lean()
const list = products.map((p, i) => `${i}: ${p.name}`).join('\n')

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const response = await ai.models.generateContent({
  model: (process.env.GEMINI_MODELS || 'gemini-3.5-flash').split(',')[0].trim(),
  contents: `Group these grocery products that are the same product. Only list groups with at least one duplicate; when unsure, do not group.\n${SAME_PRODUCT_RULES}\n\nProducts:\n${list}`,
  config: { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(GroupsSchema), temperature: 0 },
})
const { groups } = GroupsSchema.parse(JSON.parse(response.text))

const used = new Set()
let mergedCount = 0
for (const g of groups) {
  const keep = products[g.keep]
  const dups = [...new Set(g.duplicates)].filter((i) => i !== g.keep && products[i] && !used.has(i)).map((i) => products[i])
  if (!keep || used.has(g.keep) || dups.length === 0) continue
  used.add(g.keep)
  dups.forEach((d) => used.add(products.indexOf(d)))

  console.log(`\nKEEP  ${keep.name}`)
  dups.forEach((d) => console.log(`  ←   ${d.name}`))
  if (!apply) continue

  for (const d of dups) {
    await Price.updateMany({ product: d._id }, { $set: { product: keep._id, mergedFrom: d._id } })
    await Product.updateOne({ _id: d._id }, { $set: { mergedInto: keep._id } })
  }
  const aliases = [...new Set([...keep.aliases, ...dups.flatMap((d) => [...d.aliases, d.name])])]
  const fill = {}
  if (!keep.nameEn) fill.nameEn = dups.find((d) => d.nameEn)?.nameEn ?? ''
  if (!keep.icon) fill.icon = dups.find((d) => d.icon)?.icon ?? ''
  await Product.updateOne({ _id: keep._id }, { $set: { aliases, ...fill } })
  mergedCount += dups.length
}

console.log(
  apply
    ? `\nMerged ${mergedCount} duplicates. Undo with: npm run merge -- --undo`
    : '\nPreview only. Run "npm run merge -- --apply" to merge these.',
)
await mongoose.disconnect()
