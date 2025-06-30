import jsonwebtoken from 'jsonwebtoken'
import { ENV } from '../conf/index.js'
import { User } from '../models/user.model.js'

export async function validateUser(req, res, next) {
  try {
    const jwtToken = req.header('Authorization')
    const apiKey = req.header('x-api-key')
    // Check if neither authentication method is provided
    if (!apiKey && !jwtToken) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (apiKey) {
      const apiKeyUser = await User.findOne({ apiKey: apiKey })
      if (apiKeyUser) {
        req.user = apiKeyUser
        next()
      } else {
        return res.status(403).json({ error: 'Invalid API key' })
      }
    }

    if (jwtToken) {
      try {
        const decodedUser = jsonwebtoken.verify(jwtToken, ENV.JWT_SECRET)
        req.user = decodedUser
        return next()
      } catch {
        return res.status(403).json({ error: 'Invalid JWT token' })
      }
    }

    // return res.status(401).json({ error: 'Authentication required' })
  } catch (err) {
    res.status(500).json({ message: 'unable to process the request ', err })
  }
}
