// client/js/lead-detail.js
// Lead Detail page — view lead info, update status, manage notes
// Depends on: utils.js

// =====================================================
// STATE
// =====================================================

// Lead ID from URL: /lead-detail.html?id=...
let leadId = null;

// Current lead data (kept in memory for updates)
let currentLead = null;

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

  // Get lead ID from URL
  leadId = getQueryParam('id');

  if (!leadId) {
    showToast('No lead ID provided.', 'error');
    setTimeout(() => { window.location.href = '/leads.html'; }, 1500);
    return;
  }

  // Set minimum date for note follow-up datepicker
  const noteDate = document.getElementById('note-followup-date');
  if (noteDate) {
    noteDate.min = new Date().toISOString().split('T')[0];
  }

  // Load the lead
  await loadLead();
});

// =====================================================
// LOAD LEAD
// =====================================================

/**
 * loadLead — Fetches lead data from API and renders the page
 */
async function loadLead() {
  const data = await apiRequest(`/api/leads/${leadId}`);

  // Hide loading, show content
  const loadingEl = document.getElementById('page-loading');
  const contentEl = document.getElementById('page-content');

  if (!data.success) {
    if (loadingEl) loadingEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Lead not found</h3>
        <p>This lead may have been deleted.</p>
        <a href="/leads.html" class="btn btn-primary btn-sm mt-4">← Back to Leads</a>
      </div>
    `;
    return;
  }

  currentLead = data.data;

  if (loadingEl) loadingEl.classList.add('hidden');
  if (contentEl) contentEl.classList.remove('hidden');

  // Render all sections
  renderProfile(currentLead);
  renderContactInfo(currentLead);
  renderDealInfo(currentLead);
  renderNotes(currentLead.notes || []);
  setEditLinks(leadId);
  setStatusSelect(currentLead.status);
  renderDescription(currentLead.description);

  // Update page title
  document.title = `Mini CRM — ${currentLead.name}`;
}

// =====================================================
// RENDER FUNCTIONS
// =====================================================

/**
 * renderProfile — Fills in the profile card header
 */
function renderProfile(lead) {
  // Page heading
  const h1 = document.getElementById('detail-lead-name');
  if (h1) h1.textContent = lead.name;

  // Topbar title
  const topbarTitle = document.getElementById('topbar-lead-name');
  if (topbarTitle) topbarTitle.textContent = lead.name;

  // Meta line below heading
  const meta = document.getElementById('detail-lead-meta');
  if (meta) {
    const parts = [];
    if (lead.company)  parts.push(lead.company);
    if (lead.position) parts.push(lead.position);
    parts.push(`Added ${formatDate(lead.createdAt)}`);
    meta.textContent = parts.join(' · ');
  }

  // Avatar
  const avatar = document.getElementById('detail-avatar');
  if (avatar) avatar.textContent = getInitials(lead.name);

  // Profile name
  const name = document.getElementById('profile-name');
  if (name) name.textContent = lead.name;

  // Company
  const company = document.getElementById('profile-company');
  if (company) {
    company.textContent = lead.company
      ? `${lead.company}${lead.position ? ' · ' + lead.position : ''}`
      : lead.position || '';
  }

  // Badges
  const badges = document.getElementById('profile-badges');
  if (badges) {
    badges.innerHTML =
      getStatusBadgeHTML(lead.status) +
      getPriorityBadgeHTML(lead.priority) +
      `<span class="badge" style="background:rgba(100,116,139,0.15);
              color:var(--text-secondary);border:1px solid rgba(100,116,139,0.2)">
        ${escapeHtml(lead.source || 'Other')}
      </span>`;
  }
}

/**
 * renderContactInfo — Populates the contact info grid
 */
function renderContactInfo(lead) {
  const grid = document.getElementById('contact-info-grid');
  if (!grid) return;

  const items = [
    {
      label: 'Email',
      value: lead.email
        ? `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>`
        : '—',
    },
    {
      label: 'Phone',
      value: lead.phone
        ? `<a href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a>`
        : '—',
    },
    {
      label: 'Company',
      value: escapeHtml(lead.company || '—'),
    },
    {
      label: 'Position',
      value: escapeHtml(lead.position || '—'),
    },
    {
      label: 'Created By',
      value: escapeHtml(lead.createdBy?.name || 'Unknown'),
    },
    {
      label: 'Last Updated',
      value: formatDate(lead.updatedAt, true),
    },
  ];

  grid.innerHTML = items.map(item => `
    <div class="lead-info-item">
      <div class="lead-info-label">${escapeHtml(item.label)}</div>
      <div class="lead-info-value">${item.value}</div>
    </div>
  `).join('');
}

/**
 * renderDealInfo — Populates the deal & timeline grid
 */
function renderDealInfo(lead) {
  const grid = document.getElementById('deal-info-grid');
  if (!grid) return;

  const items = [
    {
      label: 'Deal Value',
      value: lead.dealValue > 0
        ? `<strong style="color:var(--success)">${formatCurrency(lead.dealValue)}</strong>`
        : '—',
    },
    {
      label: 'Status',
      value: getStatusBadgeHTML(lead.status),
    },
    {
      label: 'Last Contacted',
      value: lead.lastContactedAt
        ? formatDate(lead.lastContactedAt, true)
        : '—',
    },
    {
      label: 'Next Follow-up',
      value: lead.nextFollowUpAt
        ? `<span style="color:var(--warning)">${formatDate(lead.nextFollowUpAt)}</span>`
        : '—',
    },
    {
      label: 'Notes Count',
      value: `<strong>${(lead.notes || []).length}</strong> note${(lead.notes || []).length !== 1 ? 's' : ''}`,
    },
    {
      label: 'Created',
      value: formatDate(lead.createdAt),
    },
  ];

  grid.innerHTML = items.map(item => `
    <div class="lead-info-item">
      <div class="lead-info-label">${escapeHtml(item.label)}</div>
      <div class="lead-info-value">${item.value}</div>
    </div>
  `).join('');
}

/**
 * renderDescription — Shows or hides the description section
 */
function renderDescription(description) {
  const section = document.getElementById('description-section');
  const el      = document.getElementById('detail-description');
  if (!section || !el) return;

  if (description && description.trim()) {
    section.style.display = 'block';
    el.textContent = description;
  } else {
    section.style.display = 'none';
  }
}

/**
 * setEditLinks — Sets the href on all "Edit" buttons
 */
function setEditLinks(id) {
  const editBtn  = document.getElementById('edit-lead-btn');
  const editLink = document.getElementById('edit-lead-link');
  const href = `/add-lead.html?id=${id}`;
  if (editBtn)  editBtn.href  = href;
  if (editLink) editLink.href = href;
}

/**
 * setStatusSelect — Sets the status dropdown to current value
 */
function setStatusSelect(status) {
  const select = document.getElementById('status-select');
  if (select) select.value = status;
}

// =====================================================
// STATUS UPDATE
// =====================================================

/**
 * updateStatus — Sends PUT request to update lead status
 */
async function updateStatus() {
  const select    = document.getElementById('status-select');
  const btn       = document.getElementById('update-status-btn');
  const msgEl     = document.getElementById('status-update-msg');
  const newStatus = select?.value;

  if (!newStatus || newStatus === currentLead?.status) {
    showToast('Status is already set to ' + newStatus, 'info');
    return;
  }

  setLoading(btn, true, 'Save Status');

  const data = await apiRequest(`/api/leads/${leadId}`, {
    method: 'PUT',
    body:   JSON.stringify({ status: newStatus }),
  });

  setLoading(btn, false, 'Save Status');

  if (data.success) {
    currentLead = data.data;

    // Update badges in profile header
    const badges = document.getElementById('profile-badges');
    if (badges) {
      badges.innerHTML =
        getStatusBadgeHTML(data.data.status) +
        getPriorityBadgeHTML(data.data.priority) +
        `<span class="badge" style="background:rgba(100,116,139,0.15);
                color:var(--text-secondary);border:1px solid rgba(100,116,139,0.2)">
          ${escapeHtml(data.data.source || 'Other')}
        </span>`;
    }

    // Re-render deal info to update status row
    renderDealInfo(data.data);

    // Show brief success indicator
    if (msgEl) {
      msgEl.style.display = 'inline';
      setTimeout(() => { msgEl.style.display = 'none'; }, 2500);
    }

    showToast(`Status updated to "${newStatus}"`, 'success');
  } else {
    showToast(data.message || 'Failed to update status.', 'error');
  }
}

// =====================================================
// NOTES — RENDER
// =====================================================

/**
 * renderNotes — Builds and inserts the notes list HTML
 * @param {Array} notes - Array of note sub-documents
 */
function renderNotes(notes) {
  const list  = document.getElementById('notes-list');
  const count = document.getElementById('notes-count');

  if (count) count.textContent = `(${notes.length})`;

  if (!list) return;

  if (!notes || notes.length === 0) {
    list.innerHTML = `
      <div class="notes-empty">
        <div class="notes-empty-icon">📝</div>
        <p>No notes yet.<br>Add the first follow-up note above.</p>
      </div>
    `;
    return;
  }

  // Show newest notes first
  const sorted = [...notes].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  list.innerHTML = sorted.map(note => buildNoteHTML(note)).join('');
}

/**
 * buildNoteHTML — Returns HTML for a single note card
 * @param {object} note - Note sub-document
 */
function buildNoteHTML(note) {
  const followup = note.followUpDate
    ? `<div class="note-followup">
         📅 Follow-up: ${formatDate(note.followUpDate)}
       </div>`
    : '';

  return `
    <div class="note-item" id="note-${escapeHtml(note._id)}">
      <div class="note-item-header">
        <div class="note-item-meta">
          <div class="avatar avatar-sm"
               style="background:var(--primary);
                      border-radius:6px;flex-shrink:0">
            ${escapeHtml(getInitials(note.addedBy))}
          </div>
          <span class="note-author">${escapeHtml(note.addedBy)}</span>
          <span class="note-date">${timeAgo(note.createdAt)}</span>
        </div>
        <button
          class="note-delete-btn"
          title="Delete note"
          onclick="deleteNote('${escapeHtml(note._id)}')"
        >✕</button>
      </div>
      <div class="note-text">${escapeHtml(note.text)}</div>
      ${followup}
    </div>
  `;
}

// =====================================================
// NOTES — ADD
// =====================================================

/**
 * addNote — Reads the note form and POSTs to API
 */
async function addNote() {
  const textEl   = document.getElementById('note-text');
  const dateEl   = document.getElementById('note-followup-date');
  const btn      = document.getElementById('add-note-btn');

  const text       = textEl?.value.trim();
  const followUpDate = dateEl?.value || null;

  if (!text) {
    showToast('Please enter a note before saving.', 'warning');
    if (textEl) textEl.focus();
    return;
  }

  setLoading(btn, true, '➕ Add Note');

  const data = await apiRequest(`/api/leads/${leadId}/notes`, {
    method: 'POST',
    body:   JSON.stringify({ text, followUpDate }),
  });

  setLoading(btn, false, '➕ Add Note');

  if (data.success) {
    // Clear the form inputs
    if (textEl) textEl.value = '';
    if (dateEl) dateEl.value = '';

    // Update the in-memory lead with the new note
    if (currentLead) {
      currentLead.notes.push(data.note);
      if (data.nextFollowUpAt) {
        currentLead.nextFollowUpAt = data.nextFollowUpAt;
      }
    }

    // Re-render notes section
    renderNotes(currentLead?.notes || []);

    // Also refresh deal info (shows updated follow-up date)
    renderDealInfo(currentLead);

    showToast('Note added successfully!', 'success');
  } else {
    showToast(data.message || 'Failed to add note.', 'error');
  }
}

// =====================================================
// NOTES — DELETE
// =====================================================

/**
 * deleteNote — Removes a specific note from this lead
 * @param {string} noteId - Note sub-document _id
 */
async function deleteNote(noteId) {
  // Inline confirm (no modal needed for notes)
  if (!window.confirm('Delete this note?')) return;

  const data = await apiRequest(
    `/api/leads/${leadId}/notes/${noteId}`,
    { method: 'DELETE' }
  );

  if (data.success) {
    // Remove from in-memory array
    if (currentLead?.notes) {
      currentLead.notes = currentLead.notes.filter(
        n => n._id !== noteId
      );
    }

    // Remove the note card from DOM (without full re-render)
    const noteEl = document.getElementById(`note-${noteId}`);
    if (noteEl) {
      noteEl.style.animation = 'fadeOut 0.25s ease forwards';
      setTimeout(() => {
        noteEl.remove();
        // Update the notes count badge
        const count = document.getElementById('notes-count');
        const remaining = currentLead?.notes?.length || 0;
        if (count) count.textContent = `(${remaining})`;
        // Show empty state if no notes left
        if (remaining === 0) renderNotes([]);
      }, 250);
    }

    showToast('Note deleted.', 'success');
  } else {
    showToast(data.message || 'Failed to delete note.', 'error');
  }
}

// =====================================================
// DELETE LEAD
// =====================================================

/**
 * showDeleteModal — Opens the lead delete confirmation modal
 */
function showDeleteModal() {
  const modal  = document.getElementById('delete-modal');
  const msgEl  = document.getElementById('delete-modal-msg');
  if (msgEl && currentLead) {
    msgEl.innerHTML =
      `Are you sure you want to permanently delete <strong>${escapeHtml(currentLead.name)}</strong>?
       All ${(currentLead.notes || []).length} note(s) will also be removed.
       This action <strong>cannot be undone</strong>.`;
  }
  if (modal) modal.classList.remove('hidden');
}

/**
 * hideDeleteModal — Closes the delete modal
 */
function hideDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * deleteLead — Calls DELETE /api/leads/:id then redirects
 */
async function deleteLead() {
  const btn = document.getElementById('confirm-delete-btn');
  setLoading(btn, true, '🗑️ Delete');

  const data = await apiRequest(`/api/leads/${leadId}`, {
    method: 'DELETE',
  });

  setLoading(btn, false, '🗑️ Delete');

  if (data.success) {
    hideDeleteModal();
    showToast(data.message || 'Lead deleted.', 'success');
    setTimeout(() => {
      window.location.href = '/leads.html';
    }, 1000);
  } else {
    showToast(data.message || 'Failed to delete lead.', 'error');
    hideDeleteModal();
  }
}
