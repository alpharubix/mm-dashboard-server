import express from 'express'
import { validateUser } from '../middlewares/user.middleware.js'
import { login } from '../controllers/auth/login.controller.js'
import { register } from '../controllers/auth/register.controller.js'

const router = express.Router()

router.post('/login', login)
router.post('/register', validateUser, register)

export default router
