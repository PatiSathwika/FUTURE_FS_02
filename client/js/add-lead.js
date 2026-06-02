// client/js/add-lead.js
// Add Lead + Edit Lead page logic
// Dual-purpose: creates a new lead OR edits existing one
// Depends on: utils.js

// =====================================================
// STATE
// =====================================================

// If this is set, we're in EDIT mode
let editLeadId = null;

// Stores original lead data (for reset in edit mode)
let originalLeadData = null;

// =====================================================
// PAGE INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {

  // Guard: redirect if not logged in
  requireAuth();

  // Sidebar setup
  initSidebar();
  setActiveNavLink();
  populateUserInfo();

  // Set minimum date for follow-up datepicker to today
  setMinFollowUpDate();

  // Check if we're in edit mode (?id=... in URL)
  editLeadId = getQueryParam('id');

  if (editLeadId) {
    // ── EDIT MODE ─────────────────────────────
    await loadLeadForEdit(editLeadId);
  } else {
    // ── ADD MODE ──────────────────────────────
    setPageMode('add');
  }

  // Attach form submit handler
  initForm();
});

// =====================================================
// PAGE MODE SETUP
// =====================================================

/**
 * setPageMode — Updates all page text based on add/edit mode
 * @param {string} mode - 'add' or 'edit'
 * @param {string} leadName - Lead name (only used in edit mode)
 */
function setPageMode(mode, leadName = '') {
  const titleEl    = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  const topbarEl   = document.getElementById('page-topbar-title');
  const submitBtn  = document.getElementById('submit-btn');
  const docTitle   = document.title;

  if (mode === 'edit') {
    if (titleEl)    titleEl.textContent    = `Edit Lead`;
    if (subtitleEl) subtitleEl.textContent =
      `Editing: ${leadName}. Update any field below and save.`;
    if (topbarEl)   topbarEl.textContent   = 'Edit Lead';
    if (submitBtn)  submitBtn.textContent  = '💾 Update Lead';
    document.title = `Mini CRM — Edit Lead`;
  } else {
    if (titleEl)    titleEl.textContent    = 'Add New Lead';
    if (subtitleEl) subtitleEl.textContent =
      'Fill in the details below to add a new lead to your pipeline.';
    if (topbarEl)   topbarEl.textContent   = 'Add Lead';
    if (submitBtn)  submitBtn.textContent  = '💾 Save Lead';
    document.title = 'Mini CRM — Add Lead';
  }
}

// =====================================================
// EDIT MODE — Load existing lead data
// =====================================================

/**
 * loadLeadForEdit — Fetches lead by ID and populates the form
 * @param {string} id - Lead MongoDB ID from URL param
 */
async function loadLeadForEdit(id) {
  // Show loading skeleton
  const formEl    = document.getElementById('lead-form');
  const loadingEl = document.getElementById('form-loading');
  if (formEl)    formEl.classList.add('hidden');
  if (loadingEl) loadingEl.classList.remove('hidden');

  // GET /api/leads/:id
  const data = await apiRequest(`/api/leads/${id}`);

  // Hide loading skeleton
  if (loadingEl) loadingEl.classList.add('hidden');
  if (formEl)    formEl.classList.remove('hidden');

  if (!data.success) {
    showToast('Lead not found. Redirecting...', 'error');
    setTimeout(() => {
      window.location.href = '/leads.html';
    }, 1500);
    return;
  }

  const lead = data.data;

  // Store original data for the reset button
  originalLeadData = lead;

  // Switch to edit mode UI
  setPageMode('edit', lead.name);

  // Populate all form fields
  populateFormFields(lead);
}

/**
 * populateFormFields — Fill all form inputs with lead data
 * @param {object} lead - Lead document from API
 */
function populateFormFields(lead) {
  // Helper: safely set input value
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  };

  setVal('lead-name',        lead.name);
  setVal('lead-email',       lead.email);
  setVal('lead-phone',       lead.phone);
  setVal('lead-company',     lead.company);
  setVal('lead-position',    lead.position);
  setVal('lead-status',      lead.status);
  setVal('lead-priority',    lead.priority);
  setVal('lead-source',      lead.source);
  setVal('lead-description', lead.description);
  setVal('lead-deal-value',  lead.dealValue || '');

  // Format date for <input type="date"> (YYYY-MM-DD)
  if (lead.nextFollowUpAt) {
    const dateStr = new Date(lead.nextFollowUpAt)
      .toISOString()
      .split('T')[0];
    setVal('lead-followup', dateStr);
  }
}

// =====================================================
// FORM INIT + SUBMIT HANDLER
// =====================================================

/**
 * initForm — Attaches the submit event listener
 * Handles both create and update flows
 */
function initForm() {
  const form = document.getElementById('lead-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect all field values
    const formData = collectFormData();

    // Client-side validation
    const error = validateLeadForm(formData);
    if (error) {
      showFormError(error);
      return;
    }

    // Hide any previous error
    hideFormError();

    const submitBtn = document.getElementById('submit-btn');

    if (editLeadId) {
      // ── UPDATE existing lead ──────────────────
      await updateLead(editLeadId, formData, submitBtn);
    } else {
      // ── CREATE new lead ───────────────────────
      await createLead(formData, submitBtn);
    }
  });
}

// =====================================================
// API CALLS
// =====================================================

/**
 * createLead — POST to /api/leads to create a new lead
 * @param {object} formData  - Collected form values
 * @param {HTMLElement} btn  - Submit button element
 */
async function createLead(formData, btn) {
  setLoading(btn, true, '💾 Save Lead');

  const data = await apiRequest('/api/leads', {
    method: 'POST',
    body:   JSON.stringify(formData),
  });

  setLoading(btn, false, '💾 Save Lead');

  if (data.success) {
    showToast(`✅ Lead "${data.data.name}" created successfully!`, 'success');

    // Brief delay then redirect to the new lead's detail page
    setTimeout(() => {
      window.location.href = `/lead-detail.html?id=${data.data._id}`;
    }, 800);

  } else {
    showFormError(data.message || 'Failed to create lead.');
    showToast(data.message || 'Failed to create lead.', 'error');
  }
}

/**
 * updateLead — PUT to /api/leads/:id to update existing lead
 * @param {string} id        - Lead MongoDB ID
 * @param {object} formData  - Collected form values
 * @param {HTMLElement} btn  - Submit button element
 */
async function updateLead(id, formData, btn) {
  setLoading(btn, true, '💾 Update Lead');

  const data = await apiRequest(`/api/leads/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(formData),
  });

  setLoading(btn, false, '💾 Update Lead');

  if (data.success) {
    showToast(`✅ Lead "${data.data.name}" updated successfully!`, 'success');

    // Redirect back to lead detail page
    setTimeout(() => {
      window.location.href = `/lead-detail.html?id=${id}`;
    }, 800);

  } else {
    showFormError(data.message || 'Failed to update lead.');
    showToast(data.message || 'Failed to update lead.', 'error');
  }
}

// =====================================================
// FORM DATA COLLECTION
// =====================================================

/**
 * collectFormData — Reads all form field values
 * Returns a clean object ready to send to the API
 * @returns {object} Lead data payload
 */
function collectFormData() {
  const get = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  return {
    name:          get('lead-name'),
    email:         get('lead-email'),
    phone:         get('lead-phone'),
    company:       get('lead-company'),
    position:      get('lead-position'),
    status:        get('lead-status')   || 'New',
    priority:      get('lead-priority') || 'Medium',
    source:        get('lead-source')   || 'Other',
    description:   get('lead-description'),
    dealValue:     parseFloat(get('lead-deal-value')) || 0,
    nextFollowUpAt:get('lead-followup') || null,
  };
}

// =====================================================
// VALIDATION
// =====================================================

/**
 * validateLeadForm — Validates all required fields
 * Returns an error string or null if valid
 * @param {object} data - Collected form data
 * @returns {string|null}
 */
function validateLeadForm(data) {

  // Name is required
  if (!data.name || data.name.length < 2) {
    highlightLeadField('lead-name', true);
    return 'Lead name is required (minimum 2 characters).';
  }

  // Email is required and must be valid
  if (!data.email) {
    highlightLeadField('lead-email', true);
    return 'Email address is required.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    highlightLeadField('lead-email', true);
    return 'Please enter a valid email address.';
  }

  // Deal value must be non-negative
  if (data.dealValue < 0) {
    highlightLeadField('lead-deal-value', true);
    return 'Deal value cannot be negative.';
  }

  // If follow-up date is set, it must be today or future
  if (data.nextFollowUpAt) {
    const followUp = new Date(data.nextFollowUpAt);
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    if (followUp < today) {
      highlightLeadField('lead-followup', true);
      return 'Follow-up date must be today or a future date.';
    }
  }

  // Clear all error highlights
  ['lead-name', 'lead-email', 'lead-deal-value', 'lead-followup']
    .forEach(id => highlightLeadField(id, false));

  return null;
}

/**
 * highlightLeadField — Add/remove error state on a field
 * @param {string}  id       - Input element ID
 * @param {boolean} hasError - true to show error style
 */
function highlightLeadField(id, hasError) {
  const el = document.getElementById(id);
  if (!el) return;
  if (hasError) {
    el.classList.add('error');
    el.addEventListener('input', () => el.classList.remove('error'), { once: true });
  } else {
    el.classList.remove('error');
  }
}

// =====================================================
// FORM ERROR UI
// =====================================================

/**
 * showFormError — Display error alert below the form sections
 * @param {string} message - Error text
 */
function showFormError(message) {
  const alertEl = document.getElementById('form-error');
  const textEl  = document.getElementById('form-error-text');
  if (!alertEl) return;

  if (textEl) textEl.textContent = message;
  alertEl.classList.remove('hidden');

  // Scroll to the error message
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * hideFormError — Hide the error alert
 */
function hideFormError() {
  const alertEl = document.getElementById('form-error');
  if (alertEl) alertEl.classList.add('hidden');
}

// =====================================================
// RESET FORM
// =====================================================

/**
 * resetForm — In add mode: clears all fields
 *             In edit mode: restores original lead values
 */
function resetForm() {
  if (editLeadId && originalLeadData) {
    // Edit mode: restore original data
    populateFormFields(originalLeadData);
    showToast('Form reset to original values.', 'info');
  } else {
    // Add mode: clear all fields
    const form = document.getElementById('lead-form');
    if (form) {
      form.reset();
      // Reset selects to their defaults
      document.getElementById('lead-status').value   = 'New';
      document.getElementById('lead-priority').value = 'Medium';
      document.getElementById('lead-source').value   = 'Other';
    }
    showToast('Form cleared.', 'info');
  }
  hideFormError();
}

// =====================================================
// DATE HELPERS
// =====================================================

/**
 * setMinFollowUpDate — Sets the minimum selectable date
 * for the follow-up datepicker to today's date
 */
function setMinFollowUpDate() {
  const input = document.getElementById('lead-followup');
  if (!input) return;
  const today = new Date().toISOString().split('T')[0];
  input.min = today;
}