import express from 'express'
import sendEmail from '../controllers/email/email-send.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { validateUser } from '../middlewares/user.middleware.js'
const router = express.Router()
router.post('/email-send', validateUser, isSuperAdmin, sendEmail)

export default router
