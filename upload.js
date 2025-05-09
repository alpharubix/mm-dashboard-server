import bcrypt from 'bcryptjs'
import cors from 'cors'
import { parse } from 'date-fns'
import express from 'express'
import jwt from 'jsonwebtoken'

import { connectDB } from './db.js'
import uploadMiddleware from './middlewares/multer.js'

// controllers
import { onboardCsvParseAndSave } from './controllers/onboard.controller.js'
import { outputLimitCsvParseAndSave } from './controllers/output-limit.controller.js'
import { outputUtrCsvParseAndSave } from './controllers/output-utr.controller.js'

// models
import { ENV } from './conf/index.js'
import { Input } from './models/input.model.js'
import { OnboardNotification } from './models/onboard.model.js'
import { OutputLimit } from './models/output-limit.model.js'
import { OutputUTR } from './models/output-utr.model.js'
import { User } from './models/user.model.js'

const app = express()

const allowedOrigins = [
  'https://mm-dashboard-sepia.vercel.app',
  'https://mm-dashboard-client.vercel.app',
  'http://localhost:5173',
]

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true) // allow
      } else {
        callback(new Error('Not allowed by CORS')) // block
      }
    },
    credentials: true,
  })
)

app.use(express.json())

const PORT = process.env.PORT || 3001

// Upload csv files
app.post(
  '/onboard-upload',
  uploadMiddleware().single('csvfile'),
  async (req, res) => {
    onboardCsvParseAndSave(req, res)
    console.log(req.file.path)
  }
)

app.post(
  '/output-limit-upload',
  uploadMiddleware().single('csvfile'),
  async (req, res) => {
    outputLimitCsvParseAndSave(req, res)
    console.log(req.file.path)
  }
)

app.post(
  '/output-utr-upload',
  uploadMiddleware().single('csvfile'),
  async (req, res) => {
    outputUtrCsvParseAndSave(req, res)
    console.log(req.file.path)
  }
)

app.get('/input', async (req, res) => {
  const data = await Input.find()
  res.json(data)
})

app.get('/onboard', async (req, res) => {
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const companyName = String(req.query.companyName || '')
  const distributorCode = String(req.query.distributorCode || '')

  try {
    const filter = {}
    if (companyName) filter.companyName = new RegExp(companyName, 'i')
    if (distributorCode)
      filter.distributorCode = new RegExp(distributorCode, 'i')
    const skip = (Number(page) - 1) * Number(limit)
    const [data, total] = await Promise.all([
      OnboardNotification.find(filter).skip(skip).limit(Number(limit)),
      OnboardNotification.countDocuments(filter),
    ])

    res.status(200).json({
      data,
      skip,
      companyName,
      distributorCode,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      total,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/output-limit', async (req, res) => {
  const page = Number(req.query.page || 1)
  const limit = Number(req.query.limit || 10)
  const companyName = String(req.query.companyName || '')
  const distributorCode = String(req.query.distributorCode || '')

  try {
    const filter = {}
    if (companyName) filter.companyName = new RegExp(companyName, 'i')
    if (distributorCode)
      filter.distributorCode = new RegExp(distributorCode, 'i')

    const skip = (Number(page) - 1) * Number(limit)
    const [data, total] = await Promise.all([
      OutputLimit.find(filter).skip(skip).limit(Number(limit)),
      OutputLimit.countDocuments(filter),
    ])

    res.status(200).json({
      data,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      total,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

app.get('/output-utr', async (req, res) => {
  try {
    const {
      companyName,
      invoiceNumber,
      distributorCode,
      utr,
      fromDate,
      toDate,
      status,
      page = 1,
      limit = 10,
    } = req.query

    const filter = {}

    if (companyName) {
      filter.companyName = new RegExp(companyName, 'i')
    }
    if (invoiceNumber) {
      filter.invoiceNumber = new RegExp(invoiceNumber, 'i')
    }
    if (distributorCode) {
      filter.distributorCode = new RegExp(distributorCode, 'i')
    }
    if (utr) {
      filter.utr = new RegExp(utr, 'i')
    }
    if (status) {
      filter.status = new RegExp(status, 'i')
    }

    if (fromDate || toDate) {
      const dateFilter = {}

      if (fromDate) {
        const from = parse(fromDate, 'dd-MM-yyyy', new Date())
        dateFilter.$gte = from
      }

      if (toDate) {
        const to = parse(toDate, 'dd-MM-yyyy', new Date())
        // Set to end of the day
        to.setHours(23, 59, 59, 999)
        dateFilter.$lte = to
      }

      filter.invoiceDate = dateFilter
    }

    const skip = (Number(page) - 1) * Number(limit)

    const data = await OutputUTR.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ invoiceDate: -1 })

    const total = await OutputUTR.countDocuments(filter)

    res.json({
      data,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    })
  } catch (error) {
    console.error('Error fetching OutputUTR data:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/users', async (req, res) => {
  const data = await User.find().select('-password')
  res.json(data)
})

// Signup
app.post('/register', async (req, res) => {
  const { email, password, role } = req.body

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ email, password: hashed, role })

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    )

    res.status(201).json({ token, message: 'Registered successfully' })
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Registration failed', error: error.message })
  }
})

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  // Optional: check for missing fields
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  const user = await User.findOne({ email })
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  )

  res.json({ token, message: 'Login successful.' })
})

// Change user role
app.put('/user/:id', async (req, res) => {
  const { id } = req.params
  const { role } = req.body

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    user.role = role
    await user.save()

    res.json({ message: 'Role updated successfully' })
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Failed to update role', error: error.message })
  }
})

connectDB().then(() =>
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
)
