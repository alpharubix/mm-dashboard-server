import express from 'express'
import { validateUser } from '../middlewares/user.middleware.js'
import {
  createBanner,
  updateBanner,
  deactivateBanner,
  getBanner,
} from '../controllers/banner-automation/banner.controller.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'

const router = express.Router()

router.post('/banner', validateUser, isSuperAdmin, createBanner)
router.put('/banner', validateUser, isSuperAdmin, updateBanner)
router.put('/banner/deactivate', validateUser, isSuperAdmin, deactivateBanner)
router.get('/banner', validateUser, getBanner)

export default router
