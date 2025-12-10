import express from 'express'
import { getAllowdedDistEmailCount } from '../controllers/email/email-eligible-dist.controller.js'
import { sendmail } from '../controllers/email/email-send.controller.js'
import {
  getTemplate,
  saveEmailTemplate,
} from '../controllers/email/email-template.controller.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'
import { validateUser } from '../middlewares/user.middleware.js'

const router = express.Router()

router.get('/email-template', validateUser, isSuperAdmin, getTemplate) //responsible for getting prefilled email template
router.post('/send-mail', validateUser, isSuperAdmin, sendmail) //responsible for sending the email
router.post('/email-template', validateUser, isSuperAdmin, saveEmailTemplate) //responsible for saving the new email template
router.get(
  '/eligible-email-count',
  validateUser,
  isSuperAdmin,
  getAllowdedDistEmailCount
)

export default router
