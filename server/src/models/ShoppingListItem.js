import mongoose from 'mongoose'

// One line on a user's shopping list
const shoppingListItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1, min: 1 }, // how many packs / times the usual amount
    checked: { type: Boolean, default: false }, // ticked off while shopping
  },
  { timestamps: true },
)

shoppingListItemSchema.index({ user: 1, product: 1 }, { unique: true })

export default mongoose.model('ShoppingListItem', shoppingListItemSchema)
