// client/js/utils.js
// Shared utilities — loaded first on every page
// No imports needed — plain vanilla JS

// =====================================================
// API CONFIGURATION
// =====================================================

/**
 * Base URL for all API requests.
 *
 * In development: same origin (server serves client/ as static)
 * → requests go to http://localhost:5000/api/...
 *
 * In production: same origin on Render
 * → requests go to https://your-app.onrender.com/api/...
 *
 * Using empty string '' means all fetch() calls use
 * relative paths like '/api/leads' which works in both
 * development (port 5000) and production (no port).
 */
const API_BASE = '';

// =====================================================
// TOKEN MANAGEMENT
// JWT token is stored in localStorage under this key
// =====================================================

const TOKEN_KEY  = 'crm_token';
const USER_KEY   = 'crm_user';

/**
 * Save JWT token and user data to localStorage
 * Called after successful login or registration
 * @param {string} token  - JWT token string
 * @param {object} user   - Safe user object (no password)
 */
function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get the stored JWT token
 * @returns {string|null} JWT token or null if not logged in
 */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get the stored user object
 * @returns {object|null} User object or null
 */
function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear all auth data from localStorage
 * Called on logout
 */
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Check if user is currently logged in
 * (has a token stored — doesn't verify expiry)
 * @returns {boolean}
 */
function isLoggedIn() {
  return !!getToken();
}

// =====================================================
// AUTH GUARD
// =====================================================

/**
 * requireAuth — Redirect to login if not authenticated
 * Call this at the top of every protected page's script.
 *
 * Usage (at top of dashboard.js, leads.js, etc.):
 *   requireAuth();
 *
 * If no token found → redirects to index.html immediately
 */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/**
 * redirectIfLoggedIn — Redirect away from auth page if
 * already logged in. Call at top of auth page's script.
 *
 * Usage (at top of auth.js):
 *   redirectIfLoggedIn();
 *
 * If token found → redirects to dashboard.html
 */
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = '/dashboard.html';
  }
}

/**
 * logout — Clear auth data and redirect to login page
 * Called by logout button in sidebar
 */
function logout() {
  clearAuth();
  window.location.href = '/index.html';
}

// =====================================================
// AUTHENTICATED FETCH WRAPPER
// =====================================================

/**
 * apiRequest — Wrapper around fetch() that:
 *   1. Prepends API_BASE to the URL
 *   2. Sets Content-Type: application/json
 *   3. Automatically adds Authorization: Bearer <token>
 *   4. Handles 401 responses (token expired → logout)
 *   5. Parses and returns the JSON response
 *
 * @param {string} endpoint  - API path e.g. '/api/leads'
 * @param {object} options   - fetch() options (method, body, etc.)
 * @returns {Promise<object>} Parsed JSON response
 *
 * Usage examples:
 *   const data = await apiRequest('/api/leads');
 *   const data = await apiRequest('/api/leads', {
 *     method: 'POST',
 *     body: JSON.stringify({ name: 'John' })
 *   });
 */
async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  // Build headers — merge defaults with any provided headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Attach JWT token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build final fetch options
  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    // Make the HTTP request
    const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

    // Parse JSON response body
    const data = await response.json();

    // Handle 401 Unauthorized — token expired or invalid
    if (response.status === 401) {
      // Clear stale auth data
      clearAuth();
      // Show brief message then redirect
      showToast('Session expired. Please log in again.', 'warning');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1500);
      // Return the error data for caller to handle
      return { success: false, message: 'Session expired.' };
    }

    return data;

  } catch (error) {
    // Network error (server down, no internet, etc.)
    console.error(`API request failed [${endpoint}]:`, error);

    // Return a consistent error shape
    return {
      success: false,
      message: 'Network error. Please check your connection.',
    };
  }
}

// =====================================================
// TOAST NOTIFICATION SYSTEM
// =====================================================

/**
 * showToast — Display a temporary notification message
 *
 * @param {string} message   - Text to display
 * @param {string} type      - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration  - Milliseconds before auto-dismiss (default 3500)
 *
 * Usage:
 *   showToast('Lead created successfully!', 'success');
 *   showToast('Failed to delete lead.', 'error');
 */
function showToast(message, type = 'info', duration = 3500) {
  // Get or create the toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  // Icon map for each toast type
  const icons = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
  `;

  // Add to container
  container.appendChild(toast);

  // Auto-remove after duration
  const removeToast = () => {
    toast.classList.add('removing');
    // Wait for CSS exit animation to finish
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  };

  const timer = setTimeout(removeToast, duration);

  // Also remove on click
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast();
  });
}

// =====================================================
// BADGE / STATUS HELPERS
// =====================================================

/**
 * getStatusBadgeHTML — Returns HTML string for a status badge
 * Uses CSS classes from style.css
 *
 * @param {string} status - Lead status value
 * @returns {string} HTML badge element string
 *
 * Usage:
 *   cell.innerHTML = getStatusBadgeHTML('New');
 */
function getStatusBadgeHTML(status) {
  // Map status values to CSS class names (all lowercase)
  const classMap = {
    'New':       'badge-new',
    'Contacted': 'badge-contacted',
    'Qualified': 'badge-qualified',
    'Converted': 'badge-converted',
    'Lost':      'badge-lost',
  };

  // Map status values to dot class names
  const dotMap = {
    'New':       'dot-new',
    'Contacted': 'dot-contacted',
    'Qualified': 'dot-qualified',
    'Converted': 'dot-converted',
    'Lost':      'dot-lost',
  };

  const cls = classMap[status] || 'badge-new';
  const dot = dotMap[status]   || 'dot-new';

  return `
    <span class="badge ${cls}">
      <span class="status-dot ${dot}"></span>
      ${escapeHtml(status)}
    </span>
  `;
}

/**
 * getPriorityBadgeHTML — Returns HTML string for a priority badge
 *
 * @param {string} priority - 'High' | 'Medium' | 'Low'
 * @returns {string} HTML badge element string
 */
function getPriorityBadgeHTML(priority) {
  const classMap = {
    'High':   'badge-high',
    'Medium': 'badge-medium',
    'Low':    'badge-low',
  };
  const cls = classMap[priority] || 'badge-low';
  return `<span class="badge ${cls}">${escapeHtml(priority)}</span>`;
}

/**
 * getInitials — Extract initials from a full name
 * Used for avatar components
 *
 * @param {string} name - Full name
 * @returns {string} Up to 2 initials e.g. "JD" from "John Doe"
 *
 * Usage:
 *   avatarEl.textContent = getInitials('John Doe'); // "JD"
 */
function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');
}

// =====================================================
// DATE / TIME FORMATTING
// =====================================================

/**
 * formatDate — Format a date string into readable form
 *
 * @param {string|Date} dateStr - ISO date string or Date object
 * @param {boolean} includeTime - Include time in output
 * @returns {string} Formatted date string
 *
 * Usage:
 *   formatDate('2024-11-13T10:30:00Z')         // "Nov 13, 2024"
 *   formatDate('2024-11-13T10:30:00Z', true)   // "Nov 13, 2024, 10:30 AM"
 */
function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';

    const options = {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    };
    if (includeTime) {
      options.hour   = '2-digit';
      options.minute = '2-digit';
    }
    return date.toLocaleDateString('en-US', options);
  } catch {
    return '—';
  }
}

/**
 * timeAgo — Returns a human-readable relative time string
 *
 * @param {string|Date} dateStr - ISO date string or Date object
 * @returns {string} e.g. "2 hours ago", "3 days ago"
 *
 * Usage:
 *   timeAgo('2024-11-10T10:00:00Z') // "3 days ago"
 */
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60)     return 'just now';
    if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return formatDate(dateStr);
  } catch {
    return '—';
  }
}

// =====================================================
// NUMBER FORMATTING
// =====================================================

/**
 * formatCurrency — Format a number as USD currency
 *
 * @param {number} amount - Number to format
 * @returns {string} e.g. "$15,000"
 *
 * Usage:
 *   formatCurrency(15000) // "$15,000"
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * formatNumber — Format a large number with commas
 *
 * @param {number} num - Number to format
 * @returns {string} e.g. "1,250"
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

// =====================================================
// SECURITY HELPERS
// =====================================================

/**
 * escapeHtml — Prevent XSS by escaping HTML special chars
 * Always use this when inserting user data into innerHTML
 *
 * @param {string} str - Raw string to escape
 * @returns {string} Safe HTML string
 *
 * Usage:
 *   element.innerHTML = `<p>${escapeHtml(userInput)}</p>`;
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// =====================================================
// DOM HELPERS
// =====================================================

/**
 * $ — Shorthand for document.querySelector
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
function $(selector) {
  return document.querySelector(selector);
}

/**
 * $$ — Shorthand for document.querySelectorAll
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * setLoading — Toggle loading state on a button
 * Shows spinner + disables button during API calls
 *
 * @param {HTMLElement} btn       - Button element
 * @param {boolean}     isLoading - true to show spinner, false to restore
 * @param {string}      originalText - Text to restore when done
 *
 * Usage:
 *   setLoading(submitBtn, true, 'Submit');
 *   // ... await API call ...
 *   setLoading(submitBtn, false, 'Submit');
 */
function setLoading(btn, isLoading, originalText) {
  if (!btn) return;
  if (isLoading) {
    btn.disabled   = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML  = `<span class="spinner spinner-sm"></span> Loading...`;
  } else {
    btn.disabled  = false;
    btn.textContent = originalText || btn.dataset.originalText || 'Submit';
  }
}

/**
 * showElement / hideElement — Toggle element visibility
 * @param {HTMLElement} el - Element to show or hide
 */
function showElement(el) {
  if (el) el.classList.remove('hidden');
}
function hideElement(el) {
  if (el) el.classList.add('hidden');
}

/**
 * setActiveNavLink — Highlight current page in sidebar nav
 * Compares current URL path to nav link hrefs
 *
 * Usage: called in DOMContentLoaded of each page
 */
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = $$('.nav-link');

  navLinks.forEach(link => {
    link.classList.remove('active');
    // Match if the link href is in the current path
    if (link.getAttribute('href') &&
        currentPath.includes(link.getAttribute('href').replace('/', ''))) {
      link.classList.add('active');
    }
  });
}

// =====================================================
// SIDEBAR TOGGLE
// =====================================================

/**
 * initSidebar — Set up sidebar collapse/expand behaviour
 * Called on every dashboard page
 *
 * - Desktop: collapses sidebar to icon-only mode
 * - Mobile:  slides sidebar in/out as overlay
 */
function initSidebar() {
  const layout        = $('.app-layout');
  const sidebar       = $('.sidebar');
  const toggleBtn     = $('#sidebar-toggle');
  const overlay       = $('.sidebar-overlay');

  if (!layout || !toggleBtn) return;

  const isMobile = () => window.innerWidth <= 900;

  toggleBtn.addEventListener('click', () => {
    if (isMobile()) {
      // Mobile: slide sidebar in/out
      sidebar.classList.toggle('mobile-open');
      if (overlay) overlay.classList.toggle('visible');
    } else {
      // Desktop: collapse/expand
      layout.classList.toggle('sidebar-collapsed');
      // Persist preference
      const collapsed = layout.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', collapsed);
    }
  });

  // Close sidebar when overlay is clicked (mobile)
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('visible');
    });
  }

  // Restore sidebar state on desktop
  if (!isMobile()) {
    const wasCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (wasCollapsed) layout.classList.add('sidebar-collapsed');
  }

  // Handle resize — close mobile overlay when going to desktop
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('visible');
    }
  });
}

// =====================================================
// USER DISPLAY HELPERS
// =====================================================

/**
 * populateUserInfo — Fill in the logged-in admin's
 * name and initials in the sidebar footer
 * Called once per page load
 */
function populateUserInfo() {
  const user = getUser();
  if (!user) return;

  // Sidebar user name
  const nameEl = $('#sidebar-user-name');
  if (nameEl) nameEl.textContent = user.name || 'Admin';

  // Sidebar user role
  const roleEl = $('#sidebar-user-role');
  if (roleEl) roleEl.textContent = user.role || 'Admin';

  // Sidebar avatar initials
  const avatarEl = $('#sidebar-avatar');
  if (avatarEl) avatarEl.textContent = getInitials(user.name);
}

// =====================================================
// QUERY STRING HELPERS
// =====================================================

/**
 * getQueryParam — Get a URL query parameter value
 *
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null
 *
 * Usage:
 *   // URL: /lead-detail.html?id=65abc123
 *   const id = getQueryParam('id'); // "65abc123"
 */
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * buildQueryString — Build a URL query string from an object
 *
 * @param {object} params - Key-value pairs
 * @returns {string} Query string e.g. "?status=New&page=1"
 *
 * Usage:
 *   buildQueryString({ status: 'New', page: 1 })
 *   // returns "?status=New&page=1"
 */
function buildQueryString(params) {
  const filtered = Object.entries(params)
    .filter(([_, v]) => v !== null && v !== undefined && v !== '' && v !== 'All')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);

  return filtered.length ? `?${filtered.join('&')}` : '';
}

// =====================================================
// CONFIRM DIALOG HELPER
// =====================================================

/**
 * confirmAction — Show the delete confirmation modal
 * Returns a Promise that resolves to true (confirmed)
 * or false (cancelled)
 *
 * @param {string} message - Confirmation message to display
 * @returns {Promise<boolean>}
 *
 * Usage:
 *   const confirmed = await confirmAction('Delete this lead?');
 *   if (confirmed) { // proceed with delete }
 */
function confirmAction(message = 'Are you sure?') {
  return new Promise((resolve) => {
    const modal = $('#confirm-modal');
    const msgEl = $('#confirm-modal-message');
    const yesBtn = $('#confirm-yes-btn');
    const noBtn  = $('#confirm-no-btn');

    if (!modal) {
      // Fallback to browser confirm if modal not in DOM
      resolve(window.confirm(message));
      return;
    }

    if (msgEl) msgEl.textContent = message;
    modal.classList.remove('hidden');

    // One-time click handlers
    const handleYes = () => {
      modal.classList.add('hidden');
      cleanup();
      resolve(true);
    };
    const handleNo = () => {
      modal.classList.add('hidden');
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
    };

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
  });
}