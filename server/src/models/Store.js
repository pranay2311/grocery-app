import mongoose from 'mongoose'

// One document per store branch, e.g. "Lidl, Hauptstraße 5, 10115 Berlin".
const storeSchema = new mongoose.Schema(
  {
    chain: { type: String, required: true, trim: true }, // "Lidl", "Aldi Süd", "REWE"
    chainKey: { type: String, required: true, index: true }, // normalized: "lidl"
    address: { type: String, trim: true, default: '' },
    postcode: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    branchKey: { type: String, required: true, unique: true }, // chainKey + address + postcode
  },
  { timestamps: true },
)

export default mongoose.model('Store', storeSchema)
