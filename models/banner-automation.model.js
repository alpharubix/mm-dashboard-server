import mongoose from 'mongoose'

const bannerAutomation = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
})

export const BannerAutomation = mongoose.model(
  'BannerAutomation',
  bannerAutomation
)
