import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ENV } from '../conf/index.js'
import { User } from '../models/user.model.js'

export const register = async (req, res) => {
  const { email, password, role, companyId } = req.body
  if (!email || !password || !role || !companyId) {
    return res
      .status(400)
      .json({ message: 'Email,password,role and companyId are required' })
  }

  try {
    const existing = await User.findOne({ email })
    if (existing)
      return res.status(409).json({ message: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ email, password: hashed, role, companyId })

    const token = jwt.sign(
      { id: user._id, email, role, companyId },
      ENV.JWT_SECRET,
      {
        expiresIn: '1h',
      }
    )
    res.status(201).json({ token, message: 'Registered successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ email })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }
  //if user email and password is validated then send the role and company id as jwt code
  const token = jwt.sign(
    { id: user._id, email, role: user.role, companyId: user.companyId },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  )
  res.json({ token, message: 'Login successful.' })
}
