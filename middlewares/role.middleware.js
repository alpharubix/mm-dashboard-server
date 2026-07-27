export function isSuperAdmin(req, res, next) {
  //get the role from the req object and check
  const user = req.user
  if (user.role === 'superAdmin') {
    //move to the next multer
    next()
  } else {
    res.status(401).json({ message: 'Forbidden: Insufficient role' })
  }
}

export function isAdminOrSuperAdmin(req, res, next) {
  const user = req.user
  if (user && (user.role === 'superAdmin' || user.role === 'admin')) {
    next()
  } else {
    res.status(403).json({ message: 'Forbidden: Access restricted to Admin and SuperAdmin' })
  }
}

