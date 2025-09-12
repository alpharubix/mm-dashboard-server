import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import corsMiddleware from './utils/cors.js'

import authRoutes from './routes/auth.route.js'
import creditLimitRoutes from './routes/credit-limit.route.js'
import invoiceRoutes from './routes/invoice.route.js'
import onboardRoutes from './routes/onboard.route.js'
import userRoutes from './routes/user.route.js'
import viewerRoutes from './routes/viewer.route.js'

const routes = [
  authRoutes,
  onboardRoutes,
  creditLimitRoutes,
  invoiceRoutes,
  userRoutes,
  viewerRoutes,
]

export const app = express()

app.set('trust proxy', true)

// logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// security
app.use(helmet())

app.use(express.json())
app.use(corsMiddleware)

// TODO -
// app.get('/', (req, res) => {
//   res.redirect('/docs');  // or your Swagger UI, React router, etc.
// });

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'R1Xchange(formerly Meramerchant) API',
  })
})

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }))

routes.forEach((r) => app.use('/api/v1', r))

// 404 JSON fallback for unknown API routes
app.use((req, res) => {
  console.warn(`404 - ${req.method} ${req.originalUrl}`)
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  })
})
