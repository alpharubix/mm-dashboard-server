import express from 'express'
import corsMiddleware from './utils/cors.js'

import authRoutes from './routes/auth.route.js'
import inputRoutes from './routes/input.route.js'
import onboardRoutes from './routes/onboard.route.js'
import outputLimitRoutes from './routes/output-limit.route.js'
import outputUtrRoutes from './routes/output-utr.route.js'
import userRoutes from './routes/user.route.js'

export const app = express()

app.use(express.json())
app.use(corsMiddleware)

app.use('/', inputRoutes)
app.use('/', authRoutes)
app.use('/', onboardRoutes)
app.use('/', outputLimitRoutes)
app.use('/', outputUtrRoutes)
app.use('/', userRoutes)
