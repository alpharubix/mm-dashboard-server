import cors from 'cors'

const allowedOrigins = [
  'https://mm-dashboard-client.vercel.app',
  'http://localhost:5173',
]

const corsMiddleware = cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
})

export default corsMiddleware
