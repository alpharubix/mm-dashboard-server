import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'viewer'],
      default: 'viewer',
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

export const User = mongoose.model('User', UserSchema)
