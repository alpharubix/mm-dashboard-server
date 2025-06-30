import express from 'express'
import { getUsers, updateUserRole } from '../controllers/user.controller.js'
import { validateUser } from '../middlewares/user.middleware.js'
import { isSuperAdmin } from '../middlewares/role.middleware.js'

const router = express.Router()

router.get('/users', validateUser, isSuperAdmin, getUsers)
router.put('/user/:id', validateUser, isSuperAdmin, updateUserRole)

export default router
