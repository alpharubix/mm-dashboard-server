import express from 'express'
import helmet from 'helmet'
import corsMiddleware from './utils/cors.js'

import pinoHttp from 'pino-http'
import authRoutes from './routes/auth.route.js'
import creditLimitRoutes from './routes/credit-limit.route.js'
import emailRoutes from './routes/email.route.js'
import invoiceRoutes from './routes/invoice.route.js'
import onboardRoutes from './routes/onboard.route.js'
import userRoutes from './routes/user.route.js'
import viewerRoutes from './routes/viewer.route.js'
import distributorRoutes from './routes/whitelist-dist.route.js'
import logger from './utils/logger.js'

const routes = [
  authRoutes,
  onboardRoutes,
  creditLimitRoutes,
  invoiceRoutes,
  userRoutes,
  viewerRoutes,
  emailRoutes,
  distributorRoutes,
]

export const app = express()

app.set('trust proxy', true)

// logging
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'))
// } else {
//   app.use(morgan('combined'))
// }

app.use(
  pinoHttp({
    logger,
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    },
  })
)

// security
app.use(helmet())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
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
  logger.warn({ path: req.originalUrl, method: req.method }, '404 Not Found')
  res.status(404).json({ error: 'Not Found', path: req.originalUrl })
})

app.use((err, req, res, next) => {
  logger.error({ err, path: req.originalUrl }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})
