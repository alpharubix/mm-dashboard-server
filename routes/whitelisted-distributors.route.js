import express from 'express'
import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { uploadCsv } from '../middlewares/file.middleware.js'
import { parseAndSaveDistributors } from '../controllers/whitelisted-distributor/upload-whitelisted-distributors.controller.js'

const router = express.Router()

router.post(
  '/upload-distributors',
  validateUser,
  isSuperAdmin,
  uploadCsv().single('csvfile'),
  parseAndSaveDistributors
)

export default router
