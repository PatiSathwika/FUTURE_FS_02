// client/js/leads.js
// Lead listing page — search, filter, sort, paginate, delete
// Depends on: utils.js

// =====================================================
// STATE — tracks current filter/page/sort settings
// =====================================================
const leadsState = {
  search:   '',
  status:   'All',
  priority: 'All',
  source:   'All',
  sort:     '-createdAt',
  page:     1,
  limit:    10,
  total:    0,
};

// Debounce timer for search input
let searchDebounceTimer = null;

// Stores the ID of the lead pending deletion
let pendingDeleteId = null;

// =====================================================
// PAGE INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {

  // Guard: redirect if not logged in
  requireAuth();

  // Set up sidebar and active nav
  initSidebar();
  setActiveNavLink();
  populateUserInfo();

  // Pre-fill filters from URL query params
  // e.g. /leads.html?status=New fills the status dropdown
  applyUrlParams();

  // Wire up event listeners
  initSearchInput();
  initFilterDropdowns();
  initDeleteModal();

  // Initial data load
  loadLeads();
});

// =====================================================
// URL PARAMETER PRE-FILL
// =====================================================

/**
 * applyUrlParams — Read URL query params and apply them
 * to the filter state and dropdowns before first load
 */
function applyUrlParams() {
  const status   = getQueryParam('status');
  const priority = getQueryParam('priority');
  const search   = getQueryParam('search');

  if (status) {
    leadsState.status = status;
    const el = document.getElementById('filter-status');
    if (el) el.value = status;
  }
  if (priority) {
    leadsState.priority = priority;
    const el = document.getElementById('filter-priority');
    if (el) el.value = priority;
  }
  if (search) {
    leadsState.search = search;
    const el = document.getElementById('search-input');
    if (el) el.value = search;
  }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

/**
 * initSearchInput — Attach debounced input listener to search
 * Debounce waits 400ms after user stops typing before firing
 */
function initSearchInput() {
  const input = document.getElementById('search-input');
  if (!input) return;

  input.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      leadsState.search = e.target.value.trim();
      leadsState.page   = 1; // reset to page 1 on new search
      loadLeads();
      updateClearBtn();
    }, 400); // 400ms debounce
  });
}

/**
 * initFilterDropdowns — Attach change listeners to all filter selects
 */
function initFilterDropdowns() {
  const filters = {
    'filter-status':   'status',
    'filter-priority': 'priority',
    'filter-source':   'source',
    'filter-sort':     'sort',
  };

  Object.entries(filters).forEach(([id, stateKey]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (e) => {
      leadsState[stateKey] = e.target.value;
      leadsState.page = 1; // reset pagination on filter change
      loadLeads();
      updateClearBtn();
    });
  });
}

/**
 * initDeleteModal — Wire up the delete confirmation modal buttons
 */
function initDeleteModal() {
  const cancelBtn  = document.getElementById('delete-cancel-btn');
  const confirmBtn = document.getElementById('delete-confirm-btn');
  const modal      = document.getElementById('delete-modal');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      pendingDeleteId = null;
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!pendingDeleteId) return;
      await executeDelete(pendingDeleteId);
      modal.classList.add('hidden');
      pendingDeleteId = null;
    });
  }

  // Close modal on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        pendingDeleteId = null;
      }
    });
  }
}

// =====================================================
// MAIN DATA LOADER
// =====================================================

/**
 * loadLeads — Fetches leads from API with current filters
 * and renders the table
 */
async function loadLeads() {
  showTableLoading();

  // Build query string from current state
  const query = buildQueryString({
    search:   leadsState.search,
    status:   leadsState.status,
    priority: leadsState.priority,
    source:   leadsState.source,
    sort:     leadsState.sort,
    page:     leadsState.page,
    limit:    leadsState.limit,
  });

  // GET /api/leads?search=...&status=...&page=...
  const data = await apiRequest(`/api/leads${query}`);

  if (!data.success) {
    showTableError('Failed to load leads. Please try again.');
    return;
  }

  // Update state with fresh totals
  leadsState.total = data.pagination.totalCount;

  // Update the result count text
  updateResultCount(data.pagination);

  // Update sidebar badge
  const badge = document.getElementById('sidebar-lead-count');
  if (badge) badge.textContent = data.pagination.totalCount;

  // Update page subtitle
  const subtitle = document.getElementById('leads-subtitle');
  if (subtitle) {
    subtitle.textContent = `${data.pagination.totalCount} leads found in your pipeline.`;
  }

  // Render table rows
  renderLeadsTable(data.data);

  // Render pagination
  renderPagination(data.pagination);
}

// =====================================================
// TABLE RENDERING
// =====================================================

/**
 * renderLeadsTable — Populates the table tbody with lead rows
 * @param {Array} leads - Array of lead objects from API
 */
function renderLeadsTable(leads) {
  const tbody = document.getElementById('leads-table-body');
  if (!tbody) return;

  // Empty state
  if (!leads || leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>No leads found</h3>
            <p>
              ${leadsState.search || leadsState.status !== 'All'
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first lead.'}
            </p>
            ${leadsState.search || leadsState.status !== 'All'
              ? `<button class="btn btn-secondary btn-sm mt-4"
                         onclick="clearFilters()">Clear Filters</button>`
              : `<a href="/add-lead.html" class="btn btn-primary btn-sm mt-4">
                   ➕ Add Lead</a>`
            }
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Build table rows
  tbody.innerHTML = leads.map(lead => buildLeadRow(lead)).join('');
}

/**
 * buildLeadRow — Returns the HTML string for one table row
 * @param {object} lead - Lead document from API
 * @returns {string} HTML <tr> string
 */
function buildLeadRow(lead) {
  // Truncate email if too long for display
  const email = lead.email
    ? `<a href="mailto:${escapeHtml(lead.email)}"
          style="color:var(--primary-light);font-size:var(--text-xs)"
          onclick="event.stopPropagation()">
          ${escapeHtml(lead.email)}
        </a>`
    : '<span class="text-muted">—</span>';

  // Phone display
  const phone = lead.phone
    ? `<span style="font-size:var(--text-xs);color:var(--text-muted)">
         ${escapeHtml(lead.phone)}
       </span>`
    : '';

  return `
    <tr style="cursor:pointer"
        onclick="window.location.href='/lead-detail.html?id=${escapeHtml(lead._id)}'">

      <!-- Lead name + company -->
      <td>
        <div class="lead-name-cell">
          <div class="avatar avatar-sm"
               style="background:${getAvatarColor(lead.name)};
                      border-radius:6px">
            ${escapeHtml(getInitials(lead.name))}
          </div>
          <div>
            <div class="lead-name">${escapeHtml(lead.name)}</div>
            ${lead.company
              ? `<div class="lead-company">${escapeHtml(lead.company)}</div>`
              : ''}
          </div>
        </div>
      </td>

      <!-- Email + phone -->
      <td>
        <div style="display:flex;flex-direction:column;gap:3px">
          ${email}
          ${phone}
        </div>
      </td>

      <!-- Status badge -->
      <td>${getStatusBadgeHTML(lead.status)}</td>

      <!-- Priority badge -->
      <td>${getPriorityBadgeHTML(lead.priority)}</td>

      <!-- Source -->
      <td>
        <span style="font-size:var(--text-xs);color:var(--text-secondary)">
          ${escapeHtml(lead.source || '—')}
        </span>
      </td>

      <!-- Deal value -->
      <td>
        <span style="font-weight:var(--weight-semibold);
                     color:var(--text-primary);
                     font-size:var(--text-sm)">
          ${lead.dealValue > 0 ? formatCurrency(lead.dealValue) : '—'}
        </span>
      </td>

      <!-- Date added -->
      <td>
        <span style="font-size:var(--text-xs);color:var(--text-muted)">
          ${formatDate(lead.createdAt)}
        </span>
      </td>

      <!-- Action buttons -->
      <td onclick="event.stopPropagation()">
        <div class="table-actions">
          <a href="/lead-detail.html?id=${escapeHtml(lead._id)}"
             class="action-btn view" title="View details">
            👁️
          </a>
          <a href="/add-lead.html?id=${escapeHtml(lead._id)}"
             class="action-btn edit" title="Edit lead">
            ✏️
          </a>
          <button class="action-btn delete"
                  title="Delete lead"
                  onclick="confirmDelete('${escapeHtml(lead._id)}',
                                         '${escapeHtml(lead.name)}')">
            🗑️
          </button>
        </div>
      </td>

    </tr>
  `;
}

// =====================================================
// PAGINATION
// =====================================================

/**
 * renderPagination — Builds pagination controls
 * @param {object} pagination - Pagination metadata from API
 */
function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  const info      = document.getElementById('pagination-info');
  const controls  = document.getElementById('pagination-controls');

  if (!container) return;

  // Hide pagination if only one page
  if (pagination.totalPages <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  // Info text: "Showing 1–10 of 45 leads"
  const start = (pagination.currentPage - 1) * leadsState.limit + 1;
  const end   = Math.min(
    pagination.currentPage * leadsState.limit,
    pagination.totalCount
  );
  if (info) {
    info.textContent = `Showing ${start}–${end} of ${pagination.totalCount} leads`;
  }

  if (!controls) return;

  // Build page buttons
  let buttonsHTML = '';

  // Previous button
  buttonsHTML += `
    <button class="page-btn"
            onclick="goToPage(${pagination.currentPage - 1})"
            ${!pagination.hasPrevPage ? 'disabled' : ''}>
      ←
    </button>
  `;

  // Page number buttons (show max 5 pages)
  const pages     = pagination.totalPages;
  const current   = pagination.currentPage;
  const maxVisible = 5;

  let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
  let endPage   = Math.min(pages, startPage + maxVisible - 1);

  // Adjust startPage if near the end
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  // First page + ellipsis
  if (startPage > 1) {
    buttonsHTML += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      buttonsHTML += `<span style="color:var(--text-muted);
                                   padding:0 4px;
                                   font-size:var(--text-sm)">…</span>`;
    }
  }

  // Visible page range
  for (let p = startPage; p <= endPage; p++) {
    buttonsHTML += `
      <button class="page-btn ${p === current ? 'active' : ''}"
              onclick="goToPage(${p})">
        ${p}
      </button>
    `;
  }

  // Last page + ellipsis
  if (endPage < pages) {
    if (endPage < pages - 1) {
      buttonsHTML += `<span style="color:var(--text-muted);
                                   padding:0 4px;
                                   font-size:var(--text-sm)">…</span>`;
    }
    buttonsHTML += `
      <button class="page-btn" onclick="goToPage(${pages})">${pages}</button>
    `;
  }

  // Next button
  buttonsHTML += `
    <button class="page-btn"
            onclick="goToPage(${pagination.currentPage + 1})"
            ${!pagination.hasNextPage ? 'disabled' : ''}>
      →
    </button>
  `;

  controls.innerHTML = buttonsHTML;
}

/**
 * goToPage — Navigate to a specific page number
 * @param {number} page - Target page number
 */
function goToPage(page) {
  leadsState.page = page;
  loadLeads();
  // Scroll table back to top
  const container = document.querySelector('.leads-table-container');
  if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =====================================================
// DELETE FLOW
// =====================================================

/**
 * confirmDelete — Show the delete confirmation modal
 * @param {string} id   - Lead MongoDB ID
 * @param {string} name - Lead name (shown in modal message)
 */
function confirmDelete(id, name) {
  pendingDeleteId = id;

  const msgEl = document.getElementById('delete-modal-message');
  if (msgEl) {
    msgEl.textContent =
      `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  }

  const modal = document.getElementById('delete-modal');
  if (modal) modal.classList.remove('hidden');
}

/**
 * executeDelete — Calls the API to permanently delete a lead
 * @param {string} id - Lead MongoDB ID
 */
async function executeDelete(id) {
  const confirmBtn = document.getElementById('delete-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled    = true;
    confirmBtn.textContent = '⏳ Deleting...';
  }

  const data = await apiRequest(`/api/leads/${id}`, { method: 'DELETE' });

  if (confirmBtn) {
    confirmBtn.disabled    = false;
    confirmBtn.textContent = '🗑️ Delete';
  }

  if (data.success) {
    showToast(data.message || 'Lead deleted successfully.', 'success');
    loadLeads(); // Refresh the table
  } else {
    showToast(data.message || 'Failed to delete lead.', 'error');
  }
}

// =====================================================
// FILTER HELPERS
// =====================================================

/**
 * clearFilters — Reset all filters to default state
 * Called by the "Clear" button in the toolbar
 */
function clearFilters() {
  // Reset state
  leadsState.search   = '';
  leadsState.status   = 'All';
  leadsState.priority = 'All';
  leadsState.source   = 'All';
  leadsState.sort     = '-createdAt';
  leadsState.page     = 1;

  // Reset UI controls
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';

  document.getElementById('filter-status').value   = 'All';
  document.getElementById('filter-priority').value  = 'All';
  document.getElementById('filter-source').value    = 'All';
  document.getElementById('filter-sort').value      = '-createdAt';

  updateClearBtn();
  loadLeads();
}

/**
 * updateClearBtn — Show/hide the "Clear Filters" button
 * based on whether any non-default filters are active
 */
function updateClearBtn() {
  const hasActiveFilters =
    leadsState.search   !== '' ||
    leadsState.status   !== 'All' ||
    leadsState.priority !== 'All' ||
    leadsState.source   !== 'All';

  const btn = document.getElementById('clear-filters-btn');
  if (btn) btn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
}

// =====================================================
// UI STATE HELPERS
// =====================================================

/**
 * showTableLoading — Replace tbody with a loading spinner
 */
function showTableLoading() {
  const tbody = document.getElementById('leads-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:60px;text-align:center">
          <div style="display:flex;flex-direction:column;
                      align-items:center;gap:12px">
            <div class="spinner"></div>
            <span style="color:var(--text-muted);
                         font-size:var(--text-sm)">Loading leads...</span>
          </div>
        </td>
      </tr>
    `;
  }
  // Hide pagination during load
  const pag = document.getElementById('pagination');
  if (pag) pag.style.display = 'none';
}

/**
 * showTableError — Show an error message inside the table
 * @param {string} message - Error text to display
 */
function showTableError(message) {
  const tbody = document.getElementById('leads-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>${escapeHtml(message)}</p>
            <button class="btn btn-primary btn-sm mt-4"
                    onclick="loadLeads()">Try Again</button>
          </div>
        </td>
      </tr>
    `;
  }
}

/**
 * updateResultCount — Update the result count text in toolbar
 * @param {object} pagination - Pagination object from API
 */
function updateResultCount(pagination) {
  const el = document.getElementById('result-count');
  if (el) {
    el.textContent = pagination.totalCount === 0
      ? 'No results'
      : `${formatNumber(pagination.totalCount)} lead${pagination.totalCount !== 1 ? 's' : ''}`;
  }
}

// =====================================================
// AVATAR COLOR HELPER
// =====================================================

/**
 * getAvatarColor — Returns a consistent color for a name
 * Uses a simple hash of the name to pick from a palette
 * @param {string} name - Lead name
 * @returns {string} CSS color string
 */
function getAvatarColor(name) {
  const colors = [
    '#6366f1', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316',
  ];
  if (!name) return colors[0];
  // Simple hash: sum of char codes mod palette length
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colors[hash % colors.length];
}