// server/routes/authRoutes.js

// Express Router — creates a modular, mountable route handler
const express = require('express');
const router = express.Router();

// Import controller functions
// Each function handles the business logic for its route
const {
  register,
  login,
  getMe,
  refreshToken,
  updateProfile,
} = require('../controllers/authController');

// Import protect middleware
// Used to guard routes that require authentication
const { protect } = require('../middleware/authMiddleware');

// -----------------------------------------------
// ROUTE DEFINITIONS
// Base path: /api/auth (mounted in server.js)
// Full paths are: /api/auth/register, /api/auth/login, etc.
// -----------------------------------------------

// ── PUBLIC ROUTES ──────────────────────────────
// These routes do NOT require authentication
// Anyone can call these endpoints

/**
 * @route   POST /api/auth/register
 * @desc    Register a new admin account
 * @access  Public (guarded by ADMIN_SETUP_KEY in controller)
 * @body    { name, email, password, setupKey }
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login and receive JWT token
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', login);

// ── PROTECTED ROUTES ───────────────────────────
// These routes REQUIRE a valid JWT token
// The protect middleware validates the token first
// If token is invalid/missing → 401 response
// If token is valid → req.user is set → controller runs

/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged-in admin profile
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.get('/me', protect, getMe);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token (get a new one before expiry)
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.post('/refresh', protect, refreshToken);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update admin name or email
 * @access  Protected
 * @header  Authorization: Bearer <token>
 * @body    { name?, email? }
 */
router.put('/profile', protect, updateProfile);

// -----------------------------------------------
// Export the router
// Mounted in server.js as:
//   app.use('/api/auth', authRoutes)
// -----------------------------------------------
module.exports = router;