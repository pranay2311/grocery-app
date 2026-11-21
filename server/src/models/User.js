import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true }, // scrypt "salt:hash", never the password itself
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)
