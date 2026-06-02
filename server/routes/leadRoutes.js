// server/routes/leadRoutes.js

// Express Router for modular route handling
const express = require('express');
const router = express.Router();

// Import all lead controller functions
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addNote,
  deleteNote,
  getStats,
} = require('../controllers/leadController');

// Import auth middleware
// protect — verifies JWT and sets req.user
// restrictTo — role-based access (used for delete)
const { protect, restrictTo } = require('../middleware/authMiddleware');

// -----------------------------------------------
// IMPORTANT: Apply protect middleware to ALL routes
// in this router using router.use()
// This means every route below is automatically
// protected — no need to add protect to each one
// -----------------------------------------------
router.use(protect);

// -----------------------------------------------
// STATISTICS ROUTE
// Must be defined BEFORE /:id routes
// Otherwise Express would interpret 'stats'
// as a lead ID and call getLead() instead
// -----------------------------------------------

/**
 * @route   GET /api/leads/stats
 * @desc    Get aggregated dashboard statistics
 * @access  Protected
 * @returns { totalLeads, newThisMonth, totalDealValue,
 *            byStatus, recentLeads }
 */
router.get('/stats', getStats);

// -----------------------------------------------
// LEAD COLLECTION ROUTES
// Base path: /api/leads
// -----------------------------------------------

/**
 * @route   GET /api/leads
 * @desc    Get all leads with search, filter, sort, pagination
 * @access  Protected
 * @query   search, status, priority, source, sort, page, limit
 *
 * Examples:
 *   GET /api/leads
 *   GET /api/leads?search=john
 *   GET /api/leads?status=New&priority=High
 *   GET /api/leads?sort=-createdAt&page=2&limit=10
 */
router.get('/', getLeads);

/**
 * @route   POST /api/leads
 * @desc    Create a new lead
 * @access  Protected
 * @body    { name*, email*, phone, company, position,
 *            status, priority, source, dealValue,
 *            description, nextFollowUpAt }
 *          (* = required)
 */
router.post('/', createLead);

// -----------------------------------------------
// SINGLE LEAD ROUTES
// Base path: /api/leads/:id
// :id = MongoDB ObjectId of the lead
// -----------------------------------------------

/**
 * @route   GET /api/leads/:id
 * @desc    Get a single lead by ID (with notes + creator)
 * @access  Protected
 */
router.get('/:id', getLead);

/**
 * @route   PUT /api/leads/:id
 * @desc    Update a lead (partial updates supported)
 * @access  Protected
 * @body    Any combination of lead fields to update
 */
router.put('/:id', updateLead);

/**
 * @route   DELETE /api/leads/:id
 * @desc    Permanently delete a lead
 * @access  Protected + Admin only
 *
 * restrictTo('admin') ensures only admin role can delete
 * Even if protect passes, a non-admin gets a 403
 */
router.delete('/:id', restrictTo('admin'), deleteLead);

// -----------------------------------------------
// NOTES ROUTES
// Nested under a specific lead: /api/leads/:id/notes
// Notes are embedded in the lead document (not separate collection)
// -----------------------------------------------

/**
 * @route   POST /api/leads/:id/notes
 * @desc    Add a follow-up note to a lead
 * @access  Protected
 * @body    { text*, followUpDate }
 *          (* = required)
 *
 * Example:
 *   POST /api/leads/65abc.../notes
 *   { "text": "Called client, interested in premium plan",
 *     "followUpDate": "2024-11-20" }
 */
router.post('/:id/notes', addNote);

/**
 * @route   DELETE /api/leads/:id/notes/:noteId
 * @desc    Delete a specific note from a lead
 * @access  Protected + Admin only
 *
 * :noteId = MongoDB ObjectId of the embedded note
 */
router.delete('/:id/notes/:noteId', restrictTo('admin'), deleteNote);

// -----------------------------------------------
// Export the router
// Mounted in server.js as:
//   app.use('/api/leads', leadRoutes)
// -----------------------------------------------
module.exports = router;