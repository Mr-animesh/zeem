const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const User = require("../models/User")
const auth = require("../middleware/auth")

const router = express.Router()

const normalizeEmail = (email) => String(email || "").trim().toLowerCase()

const createToken = (userId) => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not configured")
  }
  return jwt.sign({ userId }, secret, { expiresIn: "7d" })
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {}

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      })
    }

    const normalizedEmail = normalizeEmail(email)
    let user = await User.findOne({ email: normalizedEmail }).select("+password")

    if (user && user.password) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists.",
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (!user) {
      // Create a minimal user document that can later be enriched by the existing register flow.
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: passwordHash,
        location: "Not set",
        githubProfileUrl: "",
        projectSummary: { onboarded: false },
      })
    } else {
      user.name = name.trim()
      user.password = passwordHash
      await user.save()
    }

    const token = createToken(user._id.toString())

    return res.status(201).json({
      success: true,
      token,
    })
  } catch (error) {
    console.error("Signup error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to sign up.",
    })
  }
})

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      })
    }

    const normalizedEmail = normalizeEmail(email)

    const user = await User.findOne({ email: normalizedEmail }).select("+password")
    if (!user || !user.password) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password.",
      })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password.",
      })
    }

    const token = createToken(user._id.toString())

    return res.status(200).json({
      success: true,
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to log in.",
    })
  }
})

// GET /api/auth/profile (protected)
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email location githubProfileUrl profileScore createdAt updatedAt")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      })
    }

    return res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    console.error("Profile error:", error)
    return res.status(500).json({
      success: false,
      message: "Failed to load profile.",
    })
  }
})

module.exports = router
