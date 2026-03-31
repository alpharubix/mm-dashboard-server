import mongoose from 'mongoose'

const lockSchema = new mongoose.Schema({
  distributorCode: { type: String, required: true, unique: true },
  lockedAt: { type: Date, default: Date.now },
})

lockSchema.index({ lockedAt: 1 }, { expireAfterSeconds: 60 })

export const RecalculationLock = mongoose.model('RecalculationLock', lockSchema)
