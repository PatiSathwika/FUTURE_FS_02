// server/controllers/leadController.js

// Import Lead model for all database operations
const Lead = require('../models/Lead');

// -----------------------------------------------
// @desc    Get all leads with search, filter, sort
// @route   GET /api/leads
// @access  Protected
//
// Query params supported:
//   search   — text search across name, email, company
//   status   — filter by status (New|Contacted|Qualified|Converted|Lost)
//   priority — filter by priority (Low|Medium|High)
//   source   — filter by source
//   sort     — field to sort by (default: -createdAt)
//   page     — page number for pagination (default: 1)
//   limit    — results per page (default: 10)
// -----------------------------------------------
const getLeads = async (req, res) => {
  try {
    // ── Extract query parameters ──
    const {
      search,
      status,
      priority,
      source,
      sort = '-createdAt',   // default: newest first
      page = 1,
      limit = 10,
    } = req.query;

    // ── Build the filter object ──
    // Start with empty filter — will add conditions below
    const filter = {};

    // Text search across name, email, and company
    // Uses the text index defined in Lead.js
    if (search && search.trim()) {
      filter.$or = [
        // Case-insensitive regex search on multiple fields
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { company: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Filter by status if provided and valid
    if (status && status !== 'All') {
      filter.status = status;
    }

    // Filter by priority if provided and valid
    if (priority && priority !== 'All') {
      filter.priority = priority;
    }

    // Filter by source if provided and valid
    if (source && source !== 'All') {
      filter.source = source;
    }

    // ── Pagination calculations ──
    const pageNum = Math.max(1, parseInt(page));       // minimum page 1
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // 1–50
    const skip = (pageNum - 1) * limitNum;

    // ── Build sort object ──
    // Mongoose accepts a string like '-createdAt' (descending)
    // or 'name' (ascending)
    const sortOption = sort || '-createdAt';

    // ── Execute the query ──
    // Run count and data queries in parallel for performance
    const [leads, totalCount] = await Promise.all([
      Lead.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        // Populate createdBy with just name and email from User collection
        .populate('createdBy', 'name email'),

      // Count total matching documents for pagination metadata
      Lead.countDocuments(filter),
    ]);

    // ── Calculate pagination metadata ──
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json({
      success: true,
      count: leads.length,
      pagination: {
        totalCount,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
      },
      data: leads,
    });

  } catch (error) {
    console.error('Get leads error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching leads.',
    });
  }
};

// -----------------------------------------------
// @desc    Get a single lead by ID
// @route   GET /api/leads/:id
// @access  Protected
// -----------------------------------------------
const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      // Populate full admin info who created the lead
      .populate('createdBy', 'name email role');

    // Lead not found
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });

  } catch (error) {
    // Handle invalid MongoDB ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format.',
      });
    }

    console.error('Get lead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching lead.',
    });
  }
};

// -----------------------------------------------
// @desc    Create a new lead
// @route   POST /api/leads
// @access  Protected
//
// Body: { name, email, phone, company, position,
//         status, priority, source, dealValue, description }
// -----------------------------------------------
const createLead = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      position,
      status,
      priority,
      source,
      dealValue,
      description,
      nextFollowUpAt,
    } = req.body;

    // ── Validate required fields ──
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Lead name and email are required.',
      });
    }

    // ── Check for duplicate email ──
    const existingLead = await Lead.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingLead) {
      return res.status(409).json({
        success: false,
        message: `A lead with email "${email}" already exists.`,
      });
    }

    // ── Create new lead ──
    // createdBy is set from req.user (injected by protect middleware)
    const lead = await Lead.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      company: company?.trim() || '',
      position: position?.trim() || '',
      status: status || 'New',
      priority: priority || 'Medium',
      source: source || 'Other',
      dealValue: dealValue || 0,
      description: description?.trim() || '',
      nextFollowUpAt: nextFollowUpAt || null,
      createdBy: req.user._id,  // from protect middleware
    });

    // ── Populate createdBy before responding ──
    await lead.populate('createdBy', 'name email');

    console.log(`✅ New lead created: ${lead.name} by ${req.user.name}`);

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully.',
      data: lead,
    });

  } catch (error) {
    // Mongoose validation errors (schema rules violated)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    console.error('Create lead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating lead.',
    });
  }
};

// -----------------------------------------------
// @desc    Update a lead
// @route   PUT /api/leads/:id
// @access  Protected
//
// Body: any combination of lead fields
// Partial updates are supported — only send
// the fields you want to change
// -----------------------------------------------
const updateLead = async (req, res) => {
  try {
    // ── Find existing lead ──
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
      });
    }

    // ── Build update fields from request body ──
    // Only update fields that were actually sent
    const allowedFields = [
      'name', 'email', 'phone', 'company', 'position',
      'status', 'priority', 'source', 'dealValue',
      'description', 'nextFollowUpAt',
    ];

    // Filter out any fields not in allowedFields
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // ── Trim string fields ──
    ['name', 'phone', 'company', 'position', 'description'].forEach((f) => {
      if (updates[f]) updates[f] = updates[f].trim();
    });

    // ── Lowercase email if provided ──
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();

      // Check for duplicate email (excluding current lead)
      const emailExists = await Lead.findOne({
        email: updates.email,
        _id: { $ne: req.params.id }, // exclude current lead from check
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: `Another lead with email "${updates.email}" already exists.`,
        });
      }
    }

    // ── Perform the update ──
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,            // return updated document
        runValidators: true,  // apply schema validators
      }
    ).populate('createdBy', 'name email');

    console.log(`✅ Lead updated: ${updatedLead.name}`);

    return res.status(200).json({
      success: true,
      message: 'Lead updated successfully.',
      data: updatedLead,
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format.',
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    console.error('Update lead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating lead.',
    });
  }
};

// -----------------------------------------------
// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Protected
// -----------------------------------------------
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
      });
    }

    // Store name for response message before deleting
    const leadName = lead.name;

    // deleteOne() triggers any remove middleware if defined
    await lead.deleteOne();

    console.log(`🗑️  Lead deleted: ${leadName}`);

    return res.status(200).json({
      success: true,
      message: `Lead "${leadName}" deleted successfully.`,
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format.',
      });
    }

    console.error('Delete lead error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting lead.',
    });
  }
};

// -----------------------------------------------
// @desc    Add a follow-up note to a lead
// @route   POST /api/leads/:id/notes
// @access  Protected
//
// Body: { text, followUpDate }
//
// Notes are stored as an embedded array inside
// the lead document (defined in noteSchema in Lead.js)
// -----------------------------------------------
const addNote = async (req, res) => {
  try {
    const { text, followUpDate } = req.body;

    // Validate note text
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note text is required.',
      });
    }

    // Find the lead to add note to
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
      });
    }

    // ── Build the note object ──
    const newNote = {
      text: text.trim(),
      addedBy: req.user.name,       // admin name from req.user
      followUpDate: followUpDate || null,
    };

    // ── Push note into the notes array ──
    // MongoDB $push operator adds to embedded array
    lead.notes.push(newNote);

    // ── Update nextFollowUpAt if followUpDate provided ──
    if (followUpDate) {
      lead.nextFollowUpAt = new Date(followUpDate);
    }

    // ── Save the updated lead ──
    await lead.save();

    // Get the newly added note (last item in array)
    const addedNote = lead.notes[lead.notes.length - 1];

    console.log(`📝 Note added to lead: ${lead.name}`);

    return res.status(201).json({
      success: true,
      message: 'Note added successfully.',
      note: addedNote,
      nextFollowUpAt: lead.nextFollowUpAt,
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format.',
      });
    }

    console.error('Add note error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error adding note.',
    });
  }
};

// -----------------------------------------------
// @desc    Delete a note from a lead
// @route   DELETE /api/leads/:id/notes/:noteId
// @access  Protected
// -----------------------------------------------
const deleteNote = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
      });
    }

    // Find the note inside the embedded array by its _id
    const note = lead.notes.id(req.params.noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found.',
      });
    }

    // ── Remove the note using Mongoose subdocument method ──
    note.deleteOne();

    // Save the parent lead document
    await lead.save();

    return res.status(200).json({
      success: true,
      message: 'Note deleted successfully.',
    });

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format.',
      });
    }

    console.error('Delete note error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting note.',
    });
  }
};

// -----------------------------------------------
// @desc    Get dashboard statistics
// @route   GET /api/leads/stats
// @access  Protected
//
// Uses the static getStats() method defined
// in Lead.js model to run aggregation pipelines
// -----------------------------------------------
const getStats = async (req, res) => {
  try {
    // Call static method on Lead model
    const stats = await Lead.getStats();

    // Get 5 most recently added leads for dashboard preview
    const recentLeads = await Lead.find()
      .sort('-createdAt')
      .limit(5)
      .populate('createdBy', 'name')
      .select('name email company status priority createdAt');

    return res.status(200).json({
      success: true,
      data: {
        ...stats,
        recentLeads,
      },
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching statistics.',
    });
  }
};

// -----------------------------------------------
// Export all controller functions
// These are imported by leadRoutes.js
// -----------------------------------------------
module.exports = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  addNote,
  deleteNote,
  getStats,
};