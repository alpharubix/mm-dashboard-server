import mongoose from 'mongoose'

export async function connectDB() {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}/myset`)
    console.log('Connected to MongoDB')
  } catch (error) {
    console.error('MongoDB connection error:', error)
    process.exit(1)
  }
}
