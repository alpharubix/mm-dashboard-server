import mongoose from 'mongoose'
import { ENV } from './conf/index.js'

export async function connectDB() {
  try {
    await mongoose.connect(`${ENV.MONGODB_URL}/${ENV.MONGODB_DB_NAME}`)
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    process.exit(1)
  }
}
