import express from 'express'
import {
  getOnboardData,
  onboardCsvParseAndSave,
} from '../controllers/onboard.controller.js'
import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { csvUpload } from '../middlewares/file.middleware.js'

const router = express.Router()

router.post(
  '/onboard-upload',
  validateUser,
  isSuperAdmin,
  csvUpload().single('csvfile'),
  onboardCsvParseAndSave
)
router.get('/onboard', validateUser, getOnboardData)

export default router
