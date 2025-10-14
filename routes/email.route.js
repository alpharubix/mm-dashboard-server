import express from 'express'
import EmailSend from '../controllers/email/email-send.js'

const router = express.Router()

router.post('/email-send', EmailSend)

export default router
