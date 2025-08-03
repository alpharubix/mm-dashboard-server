import { User } from '../models/user.model.js'

export const getUsers = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin') {
    const data = await User.find().select('-password')
    res.status(200).json(data)
  } else {
    res.status(401).json({ message: 'Forbidden Insufficent role' })
  }
}

export const updateUserRole = async (req, res) => {
  const user = req.user
  if (user.role !== 'superAdmin') {
    res.status(401).json({ message: 'Forbidden Insufficient role' })
  }
  const { id } = req.params
  const { role } = req.body

  try {
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    user.role = role
    await user.save()
    res.json({ message: 'Role updated successfully' })
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to update role', error: err.message })
  }
}
