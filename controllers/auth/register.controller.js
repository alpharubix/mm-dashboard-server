import { User } from '../../models/user.model.js'
import { getUserName, generateCompanyPassword } from '../../utils/index.js'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export const register = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin') {
    const { role, companyId, companyName, phone, email } = req.body

    // Different validation for different roles
    if (role === 'viewer') {
      // For distributors
      if (!companyName || !phone || !email) {
        return res.status(400).json({
          message:
            'Company Name, Phone and Email are required for distributors',
        })
      }
    } else {
      // For admin/superAdmin
      if (!role || !companyId || !companyName) {
        return res.status(400).json({
          message: 'Company Name, Company ID and Role are required',
        })
      }
    }

    try {
      const username = role === 'viewer' ? phone : getUserName(companyName)
      const existing = await User.findOne({ username })
      if (existing) {
        return res.status(409).json({ message: 'username already registered' })
      }

      const password = generateCompanyPassword(companyName)
      const hashed = await bcrypt.hash(password, 10)
      const finalCompanyId = companyId || randomBytes(16).toString('hex')

      if (role === 'admin') {
        const apiKey = `mm_${randomBytes(32).toString('hex')}`
        const user = await User.create({
          username,
          companyName,
          password: hashed,
          role,
          companyId: finalCompanyId,
          apiKey,
        })
        return res.status(201).json({
          data: { companyName, username, password, apiKey },
        })
      }

      const userData = {
        username,
        companyName,
        password: hashed,
        role,
        companyId: finalCompanyId,
      }

      // Add distributor specific fields
      if (role === 'viewer') {
        userData.phone = phone
        if (email) userData.email = email
      }

      const newUser = await User.create(userData)
      return res.status(201).json({
        data: { companyName, username, password, phone },
      })
    } catch (err) {
      res
        .status(500)
        .json({ message: 'Registration failed', error: err.message })
    }
  } else {
    res.status(401).json({ message: 'forbidden Insufficient role' })
  }
}
