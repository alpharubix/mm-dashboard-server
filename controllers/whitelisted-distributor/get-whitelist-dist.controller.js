import { Distributor } from '../../models/distributor-list.model.js'

export default async function getWhiteListDist(req, res) {
  const user = req.user
  if (user.role === 'admin' || user.role === 'viewer') {
    return res.status(403).json({ message: 'Forbidden Insufficient role' })
  }

  const dists = await Distributor.find()
  return res.json({ data: dists })
}
