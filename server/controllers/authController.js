// server/controllers/authController.js

// Import jsonwebtoken to sign tokens
const jwt = require('jsonwebtoken');

// Import User model for DB operations
const User = require('../models/User');

// -----------------------------------------------
// HELPER — generateToken
// Creates and signs a JWT token for a given user
// Called after successful registration and login
//
// Payload includes:
//   id    — MongoDB _id (used to fetch user in middleware)
//   email — for quick reference without a DB call
//   role  — for role-based access control
// -----------------------------------------------
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,           // secret key from .env
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d', // default 7 days
    }
  );
};

// -----------------------------------------------
// HELPER — sendTokenResponse
// Sends a consistent JSON response with token
// and safe user data (no password)
// -----------------------------------------------
const sendTokenResponse = (user, statusCode, res, message) => {
  // Generate signed JWT token
  const token = generateToken(user);

  // Calculate token expiry date for frontend reference
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  );

  return res.status(statusCode).json({
    success: true,
    message,
    token,                    // JWT token — frontend stores this
    expiresAt,                // when the token expires
    user: user.toSafeObject(), // safe user data (no password)
  });
};

// -----------------------------------------------
// @desc    Register a new admin
// @route   POST /api/auth/register
// @access  Public (protected by ADMIN_SETUP_KEY)
//
// Body: { name, email, password, setupKey }
//
// The setupKey requirement prevents random users
// from creating admin accounts. Only someone with
// the key (set in .env) can register.
// -----------------------------------------------
const register = async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;

    // ── Validate required fields ──
    if (!name || !email || !password || !setupKey) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and setup key.',
      });
    }

    // ── Verify the admin setup key ──
    // Compares against ADMIN_SETUP_KEY in .env
    if (setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Invalid setup key. Admin registration not allowed.',
      });
    }

    // ── Check if email is already registered ──
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An admin with this email already exists.',
      });
    }

    // ── Validate password strength ──
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // ── Create the new admin user ──
    // Password hashing happens automatically via
    // the pre-save middleware in User.js
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,               // will be hashed by pre-save hook
      role: 'admin',
    });

    // ── Log the registration ──
    console.log(`✅ New admin registered: ${user.email}`);

    // ── Send response with token ──
    sendTokenResponse(user, 201, res, 'Admin registered successfully.');

  } catch (error) {
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    // Handle duplicate key error (race condition on email unique index)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An admin with this email already exists.',
      });
    }

    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration.',
    });
  }
};

// -----------------------------------------------
// @desc    Login admin and return JWT token
// @route   POST /api/auth/login
// @access  Public
//
// Body: { email, password }
//
// Flow:
//   1. Find user by email (with password selected)
//   2. Compare entered password with stored hash
//   3. Update lastLogin timestamp
//   4. Return JWT token + user data
// -----------------------------------------------
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validate required fields ──
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // ── Find user by email ──
    // We use .select('+password') because password has select:false
    // in the schema — it won't be returned by default queries
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select('+password');

    // ── User not found ──
    // Use a generic message to avoid revealing which field is wrong
    // (security best practice — don't confirm if email exists)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── Check if account is active ──
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact support.',
      });
    }

    // ── Verify password ──
    // comparePassword is defined as an instance method in User.js
    // bcrypt.compare handles the hashing + comparison internally
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── Update last login timestamp ──
    user.lastLogin = new Date();
    // Use save() to trigger pre-save middleware
    // but password isn't modified so it won't re-hash
    await user.save({ validateBeforeSave: false });

    // ── Log successful login ──
    console.log(`✅ Admin logged in: ${user.email}`);

    // ── Send response with JWT token ──
    sendTokenResponse(user, 200, res, 'Login successful.');

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

// -----------------------------------------------
// @desc    Get currently logged-in admin profile
// @route   GET /api/auth/me
// @access  Protected (requires valid JWT)
//
// req.user is attached by protect middleware in
// authMiddleware.js — no need to query DB again
// -----------------------------------------------
const getMe = async (req, res) => {
  try {
    // req.user was set by the protect middleware
    // It already has the user object without password
    return res.status(200).json({
      success: true,
      user: req.user.toSafeObject(),
    });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching profile.',
    });
  }
};

// -----------------------------------------------
// @desc    Refresh JWT token
// @route   POST /api/auth/refresh
// @access  Protected (requires valid JWT)
//
// Frontend can call this before token expiry
// to get a fresh token without logging in again
// -----------------------------------------------
const refreshToken = async (req, res) => {
  try {
    // req.user is set by protect middleware
    // Simply generate and return a new token
    sendTokenResponse(req.user, 200, res, 'Token refreshed successfully.');
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error refreshing token.',
    });
  }
};

// -----------------------------------------------
// @desc    Update admin profile (name/email)
// @route   PUT /api/auth/profile
// @access  Protected
//
// Body: { name, email }
// -----------------------------------------------
const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one field to update.',
      });
    }

    // findByIdAndUpdate with runValidators ensures schema rules apply
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      {
        new: true,            // return the updated document
        runValidators: true,  // run schema validators on update
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser.toSafeObject(),
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This email is already in use.',
      });
    }

    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile.',
    });
  }
};

// Export all controller functions
module.exports = {
  register,
  login,
  getMe,
  refreshToken,
  updateProfile,
};