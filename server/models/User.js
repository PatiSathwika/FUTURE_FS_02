// server/models/User.js

// Import mongoose for schema creation
const mongoose = require('mongoose');

// Import bcryptjs for password hashing
// bcryptjs is a pure JavaScript implementation — no native bindings needed
const bcrypt = require('bcryptjs');

// -----------------------------------------------
// USER SCHEMA
// Defines the structure of admin user documents
// in the MongoDB 'users' collection
// -----------------------------------------------
const userSchema = new mongoose.Schema(
  {
    // Admin's full name — required for display in dashboard
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,               // removes leading/trailing whitespace
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    // Email — used as the login identifier, must be unique
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,             // enforces unique index in MongoDB
      lowercase: true,          // always store email in lowercase
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },

    // Password — stored as bcrypt hash, never plain text
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      // select: false means password won't be returned in queries by default
      // We'll explicitly select it only when needed (login)
      select: false,
    },

    // Role — reserved for future multi-role support
    // Currently only 'admin' is used
    role: {
      type: String,
      enum: ['admin', 'manager'],
      default: 'admin',
    },

    // Track when admin last logged in
    lastLogin: {
      type: Date,
      default: null,
    },

    // Whether this account is active or disabled
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,
  }
);

// -----------------------------------------------
// PRE-SAVE MIDDLEWARE
// Runs automatically BEFORE every .save() call
// Hashes the password only when it has been modified
// (prevents re-hashing an already hashed password)
// -----------------------------------------------
userSchema.pre('save', async function (next) {
  // 'this' refers to the current user document being saved

  // Skip hashing if password field wasn't changed
  // e.g. when updating name or email only
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate a salt — 12 rounds is strong but not too slow
    // Higher rounds = more secure but slower (10-12 is industry standard)
    const salt = await bcrypt.genSalt(12);

    // Hash the plain text password with the salt
    this.password = await bcrypt.hash(this.password, salt);

    next(); // proceed to save
  } catch (error) {
    next(error); // pass error to Express error handler
  }
});

// -----------------------------------------------
// INSTANCE METHOD — comparePassword
// Called on a user document instance to verify
// a plain text password against the stored hash
// Usage: const isMatch = await user.comparePassword(enteredPassword)
// -----------------------------------------------
userSchema.methods.comparePassword = async function (enteredPassword) {
  // bcrypt.compare handles the salt extraction and comparison internally
  // Returns true if match, false if not
  return await bcrypt.compare(enteredPassword, this.password);
};

// -----------------------------------------------
// INSTANCE METHOD — toSafeObject
// Returns user data without sensitive fields
// Safe to send back in API responses
// -----------------------------------------------
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

// -----------------------------------------------
// Create and export the User model
// mongoose.model('User', schema) creates a 'users'
// collection in MongoDB automatically
// -----------------------------------------------
const User = mongoose.model('User', userSchema);

module.exports = User;