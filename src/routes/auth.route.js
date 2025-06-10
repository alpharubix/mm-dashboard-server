import express from 'express'
import { login, register } from '../controllers/auth.controller.js'
import {validateUser} from '../middlewares/auth.js'

const router = express.Router()

router.post('/login', login)
router.post('/register',validateUser,register)

export default router
