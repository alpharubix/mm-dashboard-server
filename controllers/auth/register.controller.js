import { User } from '../../models/user.model.js'
import { getUserName, generateCompanyPassword } from '../../utils/index.js'
import bcrypt from 'bcryptjs'
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
      const username = getUserName(companyName)
      const existing = await User.findOne({ username })
      if (existing) {
        //check if the username is already taken or not
        return res.status(409).json({ message: 'username already registered' })
      }
      const password = generateCompanyPassword(companyName)
      const hashed = await bcrypt.hash(password, 10)
      if (role === 'admin') {
        //creating account for admin role
        const apiKey = `mm_${randomBytes(32).toString('hex')}`
        const user = await User.create({
          username,
          companyName,
          password: hashed,
          role,
          companyId,
          apiKey,
        })
        return res.status(201).json({
          data: { companyName, username, password, apiKey },
        })
      }
      const user = await User.create({
        username,
        companyName,
        password: hashed,
        role,
        companyId,
      })
      return res.status(201).json({
        data: { companyName, username, password },
      })
    } catch (err) {
      res
        .status(500)
        .json({ message: 'Registration failed', error: err.message })
    }
  } else {
    res.status(401).json({ message: 'forbidden Insufficent role' })
  }
}
