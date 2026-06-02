// server/middleware/authMiddleware.js

// Import jsonwebtoken to verify tokens
const jwt = require('jsonwebtoken');

// Import User model to fetch fresh user data from DB
const User = require('../models/User');

// -----------------------------------------------
// HELPER — sendUnauthorized
// Sends a clean 401 response with a message
// Avoids repeating res.status(401).json() everywhere
// -----------------------------------------------
const sendUnauthorized = (res, message) => {
  return res.status(401).json({
    success: false,
    message,
  });
};

// -----------------------------------------------
// MIDDLEWARE — protect
// Main authentication middleware
// Verifies JWT and attaches user to req.user
//
// Usage in routes:
//   router.get('/leads', protect, getLeads)
//
// Flow:
//   1. Check Authorization header exists
//   2. Extract Bearer token
//   3. Verify token with JWT_SECRET
//   4. Fetch user from DB (confirms user still exists)
//   5. Attach user to req.user
//   6. Call next() to proceed to route handler
// -----------------------------------------------
const protect = async (req, res, next) => {
  let token;

  // ── STEP 1: Check for Authorization header ──
  // Expected format: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Access denied. No token provided.');
  }

  // ── STEP 2: Extract the token ──
  // Split "Bearer eyJhbGci..." and take index [1]
  token = authHeader.split(' ')[1];

  // Extra check in case "Bearer " was sent with empty token
  if (!token || token === 'null' || token === 'undefined') {
    return sendUnauthorized(res, 'Access denied. Invalid token format.');
  }

  try {
    // ── STEP 3: Verify the token ──
    // jwt.verify() will throw if:
    //   - Token has been tampered with (invalid signature)
    //   - Token has expired (based on exp claim)
    //   - Token is malformed
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded now contains: { id, email, role, iat, exp }
    // These were set when the token was created in authController.js

    // ── STEP 4: Fetch the user from DB ──
    // This confirms the user still exists and is still active
    // We use .select('-password') to exclude the hashed password
    const user = await User.findById(decoded.id).select('-password');

    // User was deleted after token was issued
    if (!user) {
      return sendUnauthorized(res, 'Access denied. User no longer exists.');
    }

    // User account has been deactivated
    if (!user.isActive) {
      return sendUnauthorized(res, 'Access denied. Account has been deactivated.');
    }

    // ── STEP 5: Attach user to request ──
    // Now available as req.user in any protected route handler
    req.user = user;

    // ── STEP 6: Proceed to next middleware/route ──
    next();

  } catch (error) {
    // Handle specific JWT errors with helpful messages

    if (error.name === 'JsonWebTokenError') {
      // Token signature is invalid or token is malformed
      return sendUnauthorized(res, 'Access denied. Invalid token.');
    }

    if (error.name === 'TokenExpiredError') {
      // Token was valid but has passed its expiry time
      return sendUnauthorized(res, 'Access denied. Token has expired. Please log in again.');
    }

    if (error.name === 'NotBeforeError') {
      // Token is not yet valid (nbf claim in future)
      return sendUnauthorized(res, 'Access denied. Token not yet active.');
    }

    // Catch-all for unexpected errors
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

// -----------------------------------------------
// MIDDLEWARE — restrictTo
// Role-based access control (RBAC)
// Used to restrict certain routes to specific roles
//
// Usage in routes:
//   router.delete('/leads/:id', protect, restrictTo('admin'), deleteLead)
//
// Must be used AFTER protect middleware
// because it depends on req.user being set
// -----------------------------------------------
const restrictTo = (...roles) => {
  // Returns a middleware function that checks req.user.role
  return (req, res, next) => {
    // req.user is set by the protect middleware above
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized for this action.`,
      });
    }
    // Role is allowed — proceed
    next();
  };
};

// -----------------------------------------------
// MIDDLEWARE — optionalAuth
// For routes that work with or without authentication
// Attaches req.user if a valid token is provided
// but does NOT block the request if no token exists
// (Reserved for future public-facing features)
// -----------------------------------------------
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token — continue without setting req.user
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token || token === 'null') {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Invalid token — silently ignore and continue
  }

  next();
};

// Export all middleware functions
module.exports = { protect, restrictTo, optionalAuth };