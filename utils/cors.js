import cors from 'cors'

const allowedOrigins = [
  'https://mm-dashboard-client-three.vercel.app',
  'http://localhost:5173',
  'https://invoices.r1xchange.com',
  'https://mm-dashboard-dev.vercel.app',
  'invoices.r1xchange.com',
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
