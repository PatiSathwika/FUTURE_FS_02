// server/server.js

// -----------------------------------------------
// Load environment variables FIRST
// Must be called before any other imports that
// use process.env (like db.js, controllers, etc.)
// -----------------------------------------------
require('dotenv').config();

// ── Core Modules ──────────────────────────────
const express = require('express');
const cors    = require('cors');
const path    = require('path');  // built-in Node.js path module

// ── Internal Modules ──────────────────────────
const connectDB    = require('./config/db');
const authRoutes   = require('./routes/authRoutes');
const leadRoutes   = require('./routes/leadRoutes');

// -----------------------------------------------
// Connect to MongoDB
// Runs before server starts listening
// If connection fails, process.exit(1) is called
// in connectDB() so server never starts broken
// -----------------------------------------------
connectDB();

// -----------------------------------------------
// Initialize Express Application
// -----------------------------------------------
const app = express();

// -----------------------------------------------
// GLOBAL MIDDLEWARE
// Applied to every incoming request
// Order matters — these run top to bottom
// -----------------------------------------------

// ── CORS Configuration ────────────────────────
// Allows the frontend (different port in dev) to
// make requests to the backend API
app.use(
  cors({
    // In production, replace '*' with your actual
    // frontend domain: 'https://your-app.onrender.com'
    origin: process.env.CLIENT_URL || '*',

    // Allow these HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

    // Allow Authorization header for JWT tokens
    allowedHeaders: ['Content-Type', 'Authorization'],

    // Allow credentials (cookies, auth headers)
    credentials: true,
  })
);

// ── Body Parsers ──────────────────────────────
// Parse incoming JSON request bodies
// Makes req.body available in controllers
// limit: '10mb' prevents oversized payloads
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded form data (form submissions)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static File Serving ───────────────────────
// Serves the entire client/ folder as static assets
// This means HTML, CSS, JS files are accessible
// directly from the browser without any route handler
//
// Example: http://localhost:5000/index.html
//          http://localhost:5000/css/style.css
//
// path.join(__dirname, '..') goes up one level from
// server/ to mini-crm/, then into client/
app.use(express.static(path.join(__dirname, '..', 'client')));

// ── Request Logger (Development) ──────────────
// Logs every incoming request to the console
// Helps during development to trace API calls
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
  });
}

// -----------------------------------------------
// API ROUTES
// All API endpoints are prefixed with /api/
// This clearly separates API calls from static
// file serving
// -----------------------------------------------

// Auth routes: /api/auth/login, /api/auth/register, etc.
app.use('/api/auth', authRoutes);

// Lead routes: /api/leads, /api/leads/:id, etc.
app.use('/api/leads', leadRoutes);

// -----------------------------------------------
// HEALTH CHECK ENDPOINT
// A simple endpoint to verify the server is running
// Useful for deployment platforms like Render
// and for monitoring tools
// GET /api/health
// -----------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 Mini CRM API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// -----------------------------------------------
// CATCH-ALL ROUTE
// For any non-API GET request, serve the frontend
// This enables client-side routing — when the user
// navigates directly to /dashboard.html or refreshes,
// the server serves the file from the client/ folder
//
// Must be defined AFTER all API routes
// -----------------------------------------------
// -----------------------------------------------
// CATCH-ALL ROUTE
// Serves frontend files if they exist
// Returns a friendly message if client/ not built yet
// -----------------------------------------------
const fs = require('fs');

app.get('*', (req, res) => {
  // Skip API routes — handled above
  if (req.path.startsWith('/api/')) return;

  const indexPath = path.join(__dirname, '..', 'client', 'index.html');

  // Check if client/index.html exists before serving
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Frontend not built yet — return helpful dev message
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mini CRM — API Running</title>
          <style>
            body { font-family: sans-serif; max-width: 600px;
                   margin: 80px auto; padding: 20px; }
            h1   { color: #4f46e5; }
            code { background: #f3f4f6; padding: 4px 8px;
                   border-radius: 4px; font-size: 14px; }
            .ok  { color: #16a34a; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>🚀 Mini CRM API</h1>
          <p class="ok">✅ Backend is running successfully!</p>
          <p>The frontend files haven't been created yet.</p>
          <hr/>
          <h3>Available API Endpoints:</h3>
          <ul>
            <li><code>GET  /api/health</code></li>
            <li><code>POST /api/auth/register</code></li>
            <li><code>POST /api/auth/login</code></li>
            <li><code>GET  /api/auth/me</code></li>
            <li><code>GET  /api/leads</code></li>
            <li><code>POST /api/leads</code></li>
            <li><code>GET  /api/leads/stats</code></li>
          </ul>
        </body>
      </html>
    `);
  }
});
// -----------------------------------------------
// GLOBAL ERROR HANDLER
// Catches any errors passed via next(error) in
// route handlers or middleware
// Must have 4 parameters: (err, req, res, next)
// Express identifies it as error handler by 4 params
// -----------------------------------------------
app.use((err, req, res, next) => {
  // Log full error stack in development
  console.error('🔥 Global Error Handler:');
  console.error(err.stack || err.message);

  // Determine status code
  // Use err.statusCode if set by controller, else 500
  const statusCode = err.statusCode || 500;

  // Determine error message
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Something went wrong. Please try again.'  // hide details in prod
      : err.message || 'Internal Server Error';    // show details in dev

  res.status(statusCode).json({
    success: false,
    message,
    // Include stack trace only in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// -----------------------------------------------
// 404 HANDLER FOR UNKNOWN API ROUTES
// Catches API requests to undefined endpoints
// Must be AFTER all routes but BEFORE error handler
// -----------------------------------------------
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// -----------------------------------------------
// START THE SERVER
// Listen on PORT from .env (default: 5000)
// -----------------------------------------------
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║         Mini CRM Server Started        ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  🚀 Server    : http://localhost:${PORT}   ║`);
  console.log(`║  📁 Static    : client/ folder          ║`);
  console.log(`║  🌍 Env       : ${process.env.NODE_ENV || 'development'}              ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});

// -----------------------------------------------
// UNHANDLED PROMISE REJECTION HANDLER
// Catches async errors not caught by try/catch
// e.g. database timeouts, unexpected async failures
// -----------------------------------------------
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:');
  console.error('Reason:', reason);

  // Gracefully close server before exiting
  server.close(() => {
    console.log('Server closed due to unhandled rejection');
    process.exit(1);
  });
});

// -----------------------------------------------
// UNCAUGHT EXCEPTION HANDLER
// Catches synchronous errors not wrapped in try/catch
// e.g. undefined variable access, syntax errors at runtime
// -----------------------------------------------
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:');
  console.error(error);

  // Exit immediately — uncaught exceptions leave app
  // in an undefined state so restart is safest
  process.exit(1);
});

// Export app for testing purposes
module.exports = app;