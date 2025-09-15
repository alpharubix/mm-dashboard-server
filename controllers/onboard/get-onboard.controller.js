import { Onboard } from '../../models/onboard.model.js'

export const getOnboardData = async (req, res) => {
  const user = req.user
  if (user.role === 'superAdmin' || user.role === 'admin') {
    const page = Number(req.query.page || 1)
    const limit = Number(req.query.limit || 10)
    const companyName = String(req.query.companyName || '')
    const distributorCode = String(req.query.distributorCode || '')
    const anchorId = String(req.query.anchorId || '')

    try {
      const filter = {}
      if (user.role === 'admin') {
        filter.anchorId = user.companyId
      }
      if (companyName) filter.companyName = new RegExp(companyName, 'i')
      if (anchorId) filter.anchorId = new RegExp(anchorId, 'i')
      if (distributorCode)
        filter.distributorCode = new RegExp(distributorCode, 'i')

      // console.log('This is the filtered mongo obj', filter)

      // First get the total count
      const total = await Onboard.countDocuments(filter)
      const totalPages = Math.ceil(total / limit)

      // Then validate page number
      if (page > totalPages && total > 0) {
        return res.status(400).json({
          message: `Page ${page} does not exist. Total pages: ${totalPages}`,
          data: [],
          total,
          totalPages,
          page,
          skip: 0,
        })
      }

      const skip = (page - 1) * limit

      // Then get the data
      const data = await Onboard.find(filter, {
        createdAt: 0,
        updatedAt: 0,
        __v: 0,
      })
        .skip(skip)
        .limit(limit)

      res.status(200).json({
        message: 'Onboard data fetched successfully',
        data,
        total,
        page,
        totalPages,
        skip,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(403).json({ message: 'Forbidden: Insufficient role' })
  }
}
