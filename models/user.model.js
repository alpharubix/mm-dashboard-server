import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['superAdmin', 'admin', 'viewer'],
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      unique: true,
    },
    apiKey: {
      type: String,
      sparse: true,
      unique: true,
    },
    companyName: {
      type: String,
      unique: true,
    },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true }, // optional
  },
  {
    timestamps: true,
  }
)

export const User = mongoose.model('User', userSchema)
