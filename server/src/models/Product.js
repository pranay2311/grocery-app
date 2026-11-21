import mongoose from 'mongoose'

// A "real" product, independent of how each store abbreviates it on the receipt.
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Vollmilch 3,5% 1L"
    nameKey: { type: String, required: true, unique: true }, // normalized for matching
    nameEn: { type: String, trim: true, default: '' }, // "Whole milk 3.5% 1L"
    category: { type: String, default: '' },
    icon: { type: String, default: '' }, // one emoji, e.g. "🍌"
    unit: { type: String, enum: ['piece', 'kg', 'l'], default: 'piece' },
    // Spellings seen on receipts, e.g. "H-MILCH 3,5%" or "VOLLMILCH 1L"
    aliases: [{ type: String }],
    // Set when this product was a duplicate and got merged into another one (kept so it can be undone)
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { timestamps: true },
)

productSchema.index({ name: 'text', aliases: 'text' })
productSchema.index({ aliases: 1 })

export default mongoose.model('Product', productSchema)
