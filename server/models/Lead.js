// server/models/Lead.js

// Import mongoose for schema and model creation
const mongoose = require('mongoose');

// -----------------------------------------------
// NOTE SUB-SCHEMA
// Embedded document schema for follow-up notes
// Stored as an array inside each Lead document
// No separate MongoDB collection needed
// -----------------------------------------------
const noteSchema = new mongoose.Schema(
  {
    // The actual follow-up note text
    text: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true,
      maxlength: [1000, 'Note cannot exceed 1000 characters'],
    },

    // Who added this note (admin name for display)
    addedBy: {
      type: String,
      required: true,
      trim: true,
    },

    // When the follow-up is scheduled (optional)
    followUpDate: {
      type: Date,
      default: null,
    },
  },
  {
    // Auto-generates createdAt and updatedAt for each note
    timestamps: true,
  }
);

// -----------------------------------------------
// LEAD SCHEMA
// Main schema for client/lead documents
// Stored in MongoDB 'leads' collection
// -----------------------------------------------
const leadSchema = new mongoose.Schema(
  {
    // ── PERSONAL INFORMATION ──────────────────────

    // Lead's full name
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    // Lead's email address
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },

    // Lead's phone number (optional but useful)
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [20, 'Phone number too long'],
    },

    // Company the lead works for
    company: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Company name too long'],
    },

    // Lead's job title or position
    position: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Position title too long'],
    },

    // ── LEAD TRACKING ─────────────────────────────

    // Current status in the sales pipeline
    // This is the most important field for the CRM workflow
    status: {
      type: String,
      enum: {
        values: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
        message: '{VALUE} is not a valid status',
      },
      default: 'New',
    },

    // Priority level for this lead
    priority: {
      type: String,
      enum: {
        values: ['Low', 'Medium', 'High'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'Medium',
    },

    // Where this lead came from
    source: {
      type: String,
      enum: {
        values: [
          'Website',
          'Referral',
          'Social Media',
          'Email Campaign',
          'Cold Call',
          'Other',
        ],
        message: '{VALUE} is not a valid source',
      },
      default: 'Other',
    },

    // Estimated deal value in USD
    dealValue: {
      type: Number,
      default: 0,
      min: [0, 'Deal value cannot be negative'],
    },

    // General notes/description about the lead
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    // ── FOLLOW-UP NOTES ───────────────────────────

    // Array of embedded note sub-documents
    // Each note tracks who added it and when
    notes: [noteSchema],

    // ── RELATIONSHIPS ─────────────────────────────

    // Reference to the admin who created this lead
    // Populated via mongoose .populate() when needed
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',               // references the User model
      required: true,
    },

    // ── IMPORTANT DATES ───────────────────────────

    // When was the lead last contacted
    lastContactedAt: {
      type: Date,
      default: null,
    },

    // When is the next follow-up scheduled
    nextFollowUpAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Adds createdAt and updatedAt automatically
    timestamps: true,
  }
);

// -----------------------------------------------
// INDEXES
// Speed up common queries on these fields
// MongoDB uses these to avoid full collection scans
// -----------------------------------------------

// Text index for full-text search across name, email, company
leadSchema.index({ name: 'text', email: 'text', company: 'text' });

// Individual indexes for frequent filter/sort operations
leadSchema.index({ status: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ createdAt: -1 }); // -1 = descending (newest first)

// -----------------------------------------------
// VIRTUAL FIELD — notesCount
// Computed property, not stored in DB
// Accessible as lead.notesCount
// -----------------------------------------------
leadSchema.virtual('notesCount').get(function () {
  return this.notes.length;
});

// -----------------------------------------------
// STATIC METHOD — getStats
// Called on the Lead Model (not an instance)
// Usage: await Lead.getStats()
// Returns aggregated statistics for the dashboard
// -----------------------------------------------
leadSchema.statics.getStats = async function () {
  // MongoDB aggregation pipeline to count by status
  const statusStats = await this.aggregate([
    {
      $group: {
        _id: '$status',        // group documents by status value
        count: { $sum: 1 },   // count docs in each group
      },
    },
  ]);

  // Count total leads in collection
  const totalLeads = await this.countDocuments();

  // Sum all deal values across all leads
  const dealValueResult = await this.aggregate([
    {
      $group: {
        _id: null,
        totalValue: { $sum: '$dealValue' },
      },
    },
  ]);

  // Count leads added in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newThisMonth = await this.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Build a clean status map: { New: 5, Contacted: 3, ... }
  const statusMap = {};
  statusStats.forEach((item) => {
    statusMap[item._id] = item.count;
  });

  return {
    totalLeads,
    newThisMonth,
    totalDealValue: dealValueResult[0]?.totalValue || 0,
    byStatus: {
      New: statusMap['New'] || 0,
      Contacted: statusMap['Contacted'] || 0,
      Qualified: statusMap['Qualified'] || 0,
      Converted: statusMap['Converted'] || 0,
      Lost: statusMap['Lost'] || 0,
    },
  };
};

// -----------------------------------------------
// PRE-SAVE MIDDLEWARE
// Update lastContactedAt when status changes
// to 'Contacted' or beyond
// -----------------------------------------------
leadSchema.pre('save', function (next) {
  // If status was just changed to Contacted, record the time
  if (this.isModified('status') && this.status === 'Contacted') {
    this.lastContactedAt = new Date();
  }
  next();
});

// -----------------------------------------------
// Create and export the Lead model
// Creates 'leads' collection in MongoDB
// -----------------------------------------------
const Lead = mongoose.model('Lead', leadSchema);

module.exports = Lead;