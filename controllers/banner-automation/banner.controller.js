import { BannerAutomation } from '../../models/banner-automation.model.js'

const isSuperAdmin = (req, res) => {
  if (req.user.role !== 'superAdmin') {
    res.status(403).json({ success: false, message: 'Unauthorized' })
    return false
  }
  return true
}

const isValidDateRange = (startDate, endDate, res) => {
  if (!startDate || !endDate) {
    res
      .status(400)
      .json({ success: false, message: 'startDate and endDate are required' })
    return false
  }
  if (new Date(startDate) > new Date(endDate)) {
    res.status(400).json({ success: false, message: 'Invalid date range' })
    return false
  }
  return true
}

export const getBanner = async (req, res) => {
  try {
    const now = new Date()
    const banner = await BannerAutomation.findOne({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })

    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: 'No active banner found' })
    }

    return res.status(200).json({ success: true, data: banner })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const createBanner = async (req, res) => {
  if (!isSuperAdmin(req, res)) return

  const { title, description, startDate, endDate } = req.body

  if (!title?.trim()) {
    return res
      .status(400)
      .json({ success: false, message: 'Title is required' })
  }

  if (!isValidDateRange(startDate, endDate, res)) return

  try {
    // Create first, then deactivate — avoids wiping banners if create fails
    const banner = await BannerAutomation.create({
      title,
      description,
      startDate,
      endDate,
      isActive: true,
    })

    await BannerAutomation.updateMany(
      { isActive: true, _id: { $ne: banner._id } },
      { isActive: false }
    )

    return res.status(201).json({ success: true, data: banner })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const updateBanner = async (req, res) => {
  const { title, description, startDate, endDate } = req.body

  if (!isValidDateRange(startDate, endDate, res)) return

  try {
    const banner = await BannerAutomation.findOneAndUpdate(
      { isActive: true },
      { title, description, startDate, endDate },
      { new: true, runValidators: true }
    )

    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: 'No active banner found' })
    }

    return res.status(200).json({ success: true, data: banner })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const deactivateBanner = async (req, res) => {
  try {
    const banner = await BannerAutomation.findOneAndUpdate(
      { isActive: true },
      { isActive: false },
      { new: true }
    )

    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: 'No active banner found' })
    }

    return res.status(200).json({ success: true, data: banner })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
