// Fills in English names and icons for products saved before those fields existed.
// Only touches products where one of them is empty. Run with: npm run enrich
import { GoogleGenAI } from '@google/genai'
import mongoose from 'mongoose'
import { z } from 'zod'
import { connectDb } from '../src/db.js'
import Product from '../src/models/Product.js'
import { cleanIcon } from '../src/services/receiptSchema.js'

const ResultSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      nameEn: z.string().describe('Short natural English product name, sizes kept, decimal point'),
      icon: z.string().describe('One single emoji that best pictures this specific product'),
    }),
  ),
})

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const model = (process.env.GEMINI_MODELS || 'gemini-3.5-flash').split(',')[0].trim()
const isEmpty = (field) => [{ [field]: '' }, { [field]: { $exists: false } }]

await connectDb(process.env.MONGODB_URI)
const products = await Product.find({ $or: [...isEmpty('nameEn'), ...isEmpty('icon')] }).select('name nameEn icon')
console.log(`${products.length} products need an English name or icon`)

for (let i = 0; i < products.length; i += 50) {
  const batch = products.slice(i, i + 50)
  const response = await ai.models.generateContent({
    model,
    contents: `For each German grocery product, give an English name and one emoji that pictures it. Return every id.\n${JSON.stringify(
      batch.map((p) => ({ id: String(p._id), name: p.name })),
    )}`,
    config: { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(ResultSchema), temperature: 0 },
  })
  const { items } = ResultSchema.parse(JSON.parse(response.text))

  for (const item of items) {
    const product = batch.find((p) => String(p._id) === item.id)
    if (!product) continue
    const update = {}
    if (!product.nameEn && item.nameEn.trim()) update.nameEn = item.nameEn.trim()
    if (!product.icon && cleanIcon(item.icon)) update.icon = cleanIcon(item.icon)
    if (Object.keys(update).length === 0) continue
    await Product.updateOne({ _id: product._id }, { $set: update })
    console.log(`${update.icon ?? product.icon ?? ''}  ${product.name}${update.nameEn ? `  ->  ${update.nameEn}` : ''}`)
  }
}

await mongoose.disconnect()
