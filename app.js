import express from 'express'
import corsMiddleware from './utils/cors.js'

import authRoutes from './routes/auth.route.js'
import onboardRoutes from './routes/onboard.route.js'
import outputLimitRoutes from './routes/output-limit.route.js'
import outputUtrRoutes from './routes/output-utr.route.js'
import userRoutes from './routes/user.route.js'
import viewerRoutes from './routes/viewer.route.js'

export const app = express()

app.use(express.json())
app.use(corsMiddleware)

app.use('/api/v1', authRoutes)
app.use('/api/v1', onboardRoutes)
app.use('/api/v1', outputLimitRoutes)
app.use('/api/v1', outputUtrRoutes)
app.use('/api/v1', userRoutes)
app.use('/api/v1', viewerRoutes)
