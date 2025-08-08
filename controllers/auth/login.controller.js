import { User } from '../../models/user.model.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { ENV } from '../../conf/index.js'

export const login = async (req, res) => {
  const { username, password } = req.body
  if (!username || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  const user = await User.findOne({ username })
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' })
  }
  //if user email and password is validated then send the role and company id as jwt code
  const token = jwt.sign(
    {
      username,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
    },
    ENV.JWT_SECRET
  )
  res.json({ token, message: 'Login successful.' })
}
