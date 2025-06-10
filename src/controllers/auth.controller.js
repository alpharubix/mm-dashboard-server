import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ENV } from '../conf/index.js'
import { User } from '../models/user.model.js'
import { generateCompanyPassword, getUserName } from '../utils/index.js'
import { randomBytes } from 'crypto'

export const register = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin') {
    const { role, companyId, companyName } = req.body
    if (!role || !companyId || !companyName) {
      return res
        .status(400)
        .json({ message: 'username,password,role and companyId are required' })
    }

    try {
      const userName = getUserName(companyName)
      const existing = await User.findOne({ userName })
      if (existing)
        //check if the username is already taken or not
        return res.status(409).json({ message: 'username already registered' })
      const password = generateCompanyPassword(companyName)
      const hashed = await bcrypt.hash(password, 10)
      if (role === 'admin') {
        //creating account for admin role
        const apiKey = `mm_${randomBytes(32).toString('hex')}`
        const user = await User.create({
          userName,
          companyName,
          password: hashed,
          role,
          companyId,
          apiKey,
        })
        res.status(201).json({
          data: { companyName, userName, password, apiKey },
        })
      }
      const user = await User.create({
        userName,
        companyName,
        password: hashed,
        role,
        companyId,
      })
      res.status(201).json({ data: { userName, password } })
    } catch (err) {
      res
        .status(500)
        .json({ message: 'Registration failed', error: err.message })
    }
  } else {
    res.status(401).json({ message: 'forbidden Insufficent role' })
  }
}
export const login = async (req, res) => {
  const { userName, password } = req.body
  if (!userName || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ userName })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }
  //if user email and password is validated then send the role and company id as jwt code
  const token = jwt.sign(
    {
      userName,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
    },
    ENV.JWT_SECRET
  )
  res.json({ token, message: 'Login successful.' })
}
