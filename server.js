import { connectDB } from './db.js'
import { app } from './app.js'

const PORT = process.env.PORT || 3001

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('DB connection failed:', err)
  })
