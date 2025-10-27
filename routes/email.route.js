import express from 'express'
import sendEmail from '../controllers/email/email-send.js'

const router = express.Router()

router.post('/email-send', sendEmail)

export default router
