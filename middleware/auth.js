const jwt = require("jsonwebtoken")

/**
 * Authentication middleware using JWT bearer tokens.
 *
 * - Expects Authorization: Bearer <token>
 * - Verifies token and attaches userId to req.userId
 */
const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization || ""
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      })
    }

    const token = header.split(" ")[1]
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error("JWT_SECRET is not configured.")
      return res.status(500).json({
        success: false,
        message: "Server configuration error.",
      })
    }

    const decoded = jwt.verify(token, secret)
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      })
    }

    req.userId = decoded.userId
    return next()
  } catch (error) {
    console.error("Auth middleware error:", error.message)
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    })
  }
}

module.exports = auth
