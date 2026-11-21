import mongoose from 'mongoose'

// One price observation: product X cost Y at store Z on date D.
const priceSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt', required: true },
    // Copied from the receipt so price lists can filter fast: others only see public prices
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isPublic: { type: Boolean, default: true },
    date: { type: Date, required: true },
    rawName: { type: String }, // exactly as printed on the receipt
    // The duplicate product this price belonged to before a merge (to allow undoing it)
    mergedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    unit: { type: String, enum: ['piece', 'kg', 'l'], default: 'piece' },
    totalPrice: { type: Number, required: true }, // what was paid for this line, in EUR
    unitPrice: { type: Number }, // EUR per piece / kg / l — used to compare fairly
  },
  { timestamps: true },
)

priceSchema.index({ product: 1, unitPrice: 1 })
priceSchema.index({ store: 1, date: -1 })
priceSchema.index({ isPublic: 1, user: 1 })

export default mongoose.model('Price', priceSchema)
