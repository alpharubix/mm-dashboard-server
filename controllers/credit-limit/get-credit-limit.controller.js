import { CreditLimit } from '../../models/credit-limit.model.js'

export const getCreditLimitData = async (req, res) => {
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
        //anchor level view data control
        filter.anchorId = user.companyId
      }
      if (anchorId) filter.anchorId = new RegExp(anchorId, 'i')
      if (companyName) filter.companyName = new RegExp(companyName, 'i')
      if (distributorCode)
        filter.distributorCode = new RegExp(distributorCode, 'i')

      // First get the total count
      const total = await CreditLimit.countDocuments(filter)
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
      const data = await CreditLimit.find(filter, {
        createdAt: 0,
        updatedAt: 0,
        __v: 0,
        sno: 0,
      })
        .skip(skip)
        .limit(limit)

      res.status(200).json({
        message: 'Credit limit data fetched successfully',
        data,
        total,
        page,
        totalPages,
        skip,
      })
    } catch (err) {
      console.error('Error in getCreditLimitData:', err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(403).json({ message: 'Forbidden: Insufficient role' })
  }
}
