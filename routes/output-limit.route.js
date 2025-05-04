import { Router } from 'express'
import { OutputLimit } from '../models/output-limit.model.js'
const router = Router()

// GET /output-limit?page=1&limit=10&companyName=Foo&distributorCode=Bar
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, companyName, distributorCode } = req.query
    const filter = {}
    if (companyName) filter.companyName = new RegExp(companyName, 'i')
    if (distributorCode)
      filter.distributorCode = new RegExp(distributorCode, 'i')

    const skip = (Number(page) - 1) * Number(limit)
    // const [data, total] = await Promise.all([
    //   OutputLimit.find(filter).skip(skip).limit(Number(limit)),
    //   OutputLimit.countDocuments(filter),
    // ])
    const data = OutputLimit.find()
    res.json({
      data,
      skip,
      filter,
      // page: Number(page),
      // totalPages: Math.ceil(total / Number(limit)),
      // total,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
