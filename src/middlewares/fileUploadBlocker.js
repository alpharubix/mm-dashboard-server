export function isAllowded(req, res, next) {
  //get the role from the req object and check
  const user = req.user
  if (user.role === 'superAdmin') {
    //move to the next multer
    next()
  } else {
    res.status(401).json({ message: 'Forbidden: Insufficient role' })
  }
}
