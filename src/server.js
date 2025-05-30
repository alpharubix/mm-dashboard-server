import { app } from './app.js'
import { connectDB } from './db.js'

const PORT = process.env.PORT || 3001

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('DB connection failed:', err)
  })
