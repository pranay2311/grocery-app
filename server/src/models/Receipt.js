import mongoose from 'mongoose'

const receiptSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    date: { type: Date, required: true },
    total: { type: Number },
    // Who uploaded it
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestId: { type: String, index: true }, // browser id from before accounts existed
    // Public: its prices help everyone compare. Private: only the owner sees its prices.
    isPublic: { type: Boolean, default: true },
    itemCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('Receipt', receiptSchema)
