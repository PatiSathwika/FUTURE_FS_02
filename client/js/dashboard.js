// client/js/dashboard.js
// Dashboard page logic — stats, donut chart, recent leads
// Depends on: utils.js (loaded first in dashboard.html)

// =====================================================
// PAGE INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {

  // Guard: redirect to login if no token
  requireAuth();

  // Set up sidebar toggle + active nav link
  initSidebar();
  setActiveNavLink();

  // Fill in user name / initials in sidebar
  populateUserInfo();

  // Set greeting message with time of day
  setGreeting();

  // Load all dashboard data
  loadDashboard();
});

// =====================================================
// GREETING
// =====================================================

/**
 * setGreeting — Shows a time-aware greeting message
 * e.g. "Good morning, Admin! Here's your pipeline."
 */
function setGreeting() {
  const user = getUser();
  const name = user?.name?.split(' ')[0] || 'Admin';

  const hour = new Date().getHours();
  let period = 'Good morning';
  if (hour >= 12 && hour < 17) period = 'Good afternoon';
  else if (hour >= 17)          period = 'Good evening';

  const greetingEl = document.getElementById('dashboard-greeting');
  if (greetingEl) {
    greetingEl.textContent =
      `${period}, ${name}! Here's your pipeline overview.`;
  }
}

// =====================================================
// MAIN DATA LOADER
// =====================================================

/**
 * loadDashboard — Fetches stats from API and renders all widgets
 * Called on page load and on "Refresh" button click
 */
async function loadDashboard() {
  try {
    // Fetch aggregated stats from backend
    // GET /api/leads/stats (protected route)
    const data = await apiRequest('/api/leads/stats');

    if (!data.success) {
      showToast('Failed to load dashboard data.', 'error');
      return;
    }

    const stats = data.data;

    // Render each dashboard section
    renderStatCards(stats);
    renderDonutChart(stats.byStatus, stats.totalLeads);
    renderRecentLeads(stats.recentLeads);
    renderStatusBreakdown(stats.byStatus);

    // Update sidebar lead count badge
    const badge = document.getElementById('sidebar-lead-count');
    if (badge) badge.textContent = stats.totalLeads || 0;

  } catch (error) {
    console.error('Dashboard load error:', error);
    showToast('Error loading dashboard.', 'error');
  }
}

// =====================================================
// STAT CARDS
// =====================================================

/**
 * renderStatCards — Builds and inserts the 4 KPI stat cards
 * @param {object} stats - Stats object from API
 */
function renderStatCards(stats) {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;

  // Calculate conversion rate
  const convRate = stats.totalLeads > 0
    ? Math.round((stats.byStatus.Converted / stats.totalLeads) * 100)
    : 0;

  // Card definitions
  const cards = [
    {
      accent:  'accent-indigo',
      icon:    '👥',
      label:   'Total Leads',
      value:   formatNumber(stats.totalLeads),
      footer:  `${stats.newThisMonth} added this month`,
      change:  stats.newThisMonth > 0 ? 'up' : null,
    },
    {
      accent:  'accent-cyan',
      icon:    '🆕',
      label:   'New Leads',
      value:   formatNumber(stats.byStatus.New || 0),
      footer:  'Awaiting first contact',
      change:  null,
    },
    {
      accent:  'accent-green',
      icon:    '✅',
      label:   'Converted',
      value:   formatNumber(stats.byStatus.Converted || 0),
      footer:  `${convRate}% conversion rate`,
      change:  convRate > 0 ? 'up' : null,
    },
    {
      accent:  'accent-amber',
      icon:    '💰',
      label:   'Total Deal Value',
      value:   formatCurrency(stats.totalDealValue),
      footer:  'Across all leads',
      change:  stats.totalDealValue > 0 ? 'up' : null,
    },
  ];

  // Build HTML for all 4 cards
  grid.innerHTML = cards.map((card, i) => `
    <div class="stat-card ${escapeHtml(card.accent)}"
         style="animation-delay:${i * 0.05}s">
      <div class="stat-card-top">
        <span class="stat-card-label">${escapeHtml(card.label)}</span>
        <div class="stat-card-icon">${card.icon}</div>
      </div>
      <div class="stat-card-value">${escapeHtml(String(card.value))}</div>
      <div class="stat-card-footer">
        ${card.change === 'up'
          ? `<span class="stat-change up">↑</span>`
          : card.change === 'down'
          ? `<span class="stat-change down">↓</span>`
          : ''}
        <span>${escapeHtml(card.footer)}</span>
      </div>
    </div>
  `).join('');
}

// =====================================================
// DONUT CHART (Pure SVG — no library needed)
// =====================================================

/**
 * renderDonutChart — Draws a pure SVG donut chart
 * showing lead distribution by status
 *
 * @param {object} byStatus  - { New, Contacted, Qualified, Converted, Lost }
 * @param {number} total     - Total lead count
 */
function renderDonutChart(byStatus, total) {
  const wrapper = document.getElementById('donut-wrapper');
  if (!wrapper) return;

  // Status config: label, color, value
  const segments = [
    { label: 'New',       color: '#818cf8', value: byStatus.New       || 0 },
    { label: 'Contacted', color: '#06b6d4', value: byStatus.Contacted || 0 },
    { label: 'Qualified', color: '#f59e0b', value: byStatus.Qualified || 0 },
    { label: 'Converted', color: '#10b981', value: byStatus.Converted || 0 },
    { label: 'Lost',      color: '#ef4444', value: byStatus.Lost      || 0 },
  ].filter(s => s.value > 0); // only show segments with data

  // SVG donut chart parameters
  const size   = 180;  // SVG canvas size
  const cx     = size / 2;
  const cy     = size / 2;
  const radius = 70;   // outer radius
  const hole   = 45;   // inner hole radius (donut)
  const gap    = 2;    // gap between segments in degrees

  // If no data, show empty state
  if (total === 0 || segments.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-state-icon">🍩</div>
        <h3>No leads yet</h3>
        <p>Add your first lead to see the pipeline chart.</p>
        <a href="/add-lead.html" class="btn btn-primary btn-sm mt-4">
          ➕ Add Lead
        </a>
      </div>
    `;
    return;
  }

  // Calculate each segment's angle
  const totalVal = segments.reduce((sum, s) => sum + s.value, 0);
  let currentAngle = -90; // start at top (12 o'clock)

  // Build SVG path for each segment
  const paths = segments.map(segment => {
    const fraction  = segment.value / totalVal;
    const angleDeg  = fraction * 360 - gap;
    const startAngle = currentAngle;
    const endAngle   = currentAngle + angleDeg;
    currentAngle    += fraction * 360;

    const path = describeArc(cx, cy, radius, hole, startAngle, endAngle);

    return `
      <path
        d="${path}"
        fill="${segment.color}"
        opacity="0.9"
        class="donut-segment"
        data-label="${escapeHtml(segment.label)}"
        data-value="${segment.value}"
        style="cursor:pointer;transition:opacity 0.2s"
        onmouseenter="this.style.opacity='1'"
        onmouseleave="this.style.opacity='0.9'"
        onclick="window.location.href='/leads.html?status=${encodeURIComponent(segment.label)}'"
      >
        <title>${escapeHtml(segment.label)}: ${segment.value}</title>
      </path>
    `;
  }).join('');

  // Centre text showing total
  const centreText = `
    <text x="${cx}" y="${cy - 8}"
      text-anchor="middle"
      fill="var(--text-primary)"
      font-family="var(--font-display)"
      font-size="28"
      font-weight="800"
    >${total}</text>
    <text x="${cx}" y="${cy + 14}"
      text-anchor="middle"
      fill="var(--text-muted)"
      font-family="var(--font-body)"
      font-size="11"
    >Total Leads</text>
  `;

  // Build legend items
  const legendHTML = segments.map(s => {
    const pct = Math.round((s.value / totalVal) * 100);
    return `
      <div class="donut-legend-item">
        <div class="donut-legend-left">
          <span class="legend-dot" style="background:${s.color}"></span>
          <a href="/leads.html?status=${encodeURIComponent(s.label)}"
             class="legend-label"
             style="text-decoration:none;transition:color 0.15s"
             onmouseenter="this.style.color='var(--text-primary)'"
             onmouseleave="this.style.color=''">
            ${escapeHtml(s.label)}
          </a>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="legend-count">${s.value}</span>
          <span class="text-muted text-xs">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');

  // Assemble full chart HTML
  wrapper.innerHTML = `
    <svg
      class="donut-chart-svg"
      width="${size}"
      height="${size}"
      viewBox="0 0 ${size} ${size}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Background ring -->
      <circle
        cx="${cx}" cy="${cy}" r="${radius}"
        fill="none"
        stroke="var(--border)"
        stroke-width="${radius - hole}"
        opacity="0.3"
      />
      <!-- Segments -->
      ${paths}
      <!-- Centre label -->
      ${centreText}
    </svg>
    <div class="donut-legend">${legendHTML}</div>
  `;
}

/**
 * describeArc — Calculates the SVG path "d" attribute
 * for a donut chart segment (arc with inner hole)
 *
 * @param {number} cx, cy     - Centre point
 * @param {number} r          - Outer radius
 * @param {number} innerR     - Inner radius (hole)
 * @param {number} startAngle - Start angle in degrees
 * @param {number} endAngle   - End angle in degrees
 * @returns {string} SVG path data string
 */
function describeArc(cx, cy, r, innerR, startAngle, endAngle) {
  // Convert degrees to radians
  const toRad = deg => (deg * Math.PI) / 180;

  // Calculate outer arc points
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));

  // Calculate inner arc points (for the hole)
  const x3 = cx + innerR * Math.cos(toRad(endAngle));
  const y3 = cy + innerR * Math.sin(toRad(endAngle));
  const x4 = cx + innerR * Math.cos(toRad(startAngle));
  const y4 = cy + innerR * Math.sin(toRad(startAngle));

  // Large arc flag: 1 if segment is > 180 degrees
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,               // move to outer start
    `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, // outer arc
    `L ${x3} ${y3}`,               // line to inner end
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`, // inner arc (reverse)
    'Z',                            // close path
  ].join(' ');
}

// =====================================================
// RECENT LEADS LIST
// =====================================================

/**
 * renderRecentLeads — Renders the 5 most recent leads
 * in the right-side recent leads card
 *
 * @param {Array} leads - Array of recent lead objects
 */
function renderRecentLeads(leads) {
  const container = document.getElementById('recent-leads-list');
  if (!container) return;

  if (!leads || leads.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8)">
        <div class="empty-state-icon">📋</div>
        <p>No leads yet. <a href="/add-lead.html" style="color:var(--primary-light)">Add one!</a></p>
      </div>
    `;
    return;
  }

  container.innerHTML = leads.map((lead, i) => `
    <a href="/lead-detail.html?id=${escapeHtml(lead._id)}"
       style="
         display:block;
         padding:14px 20px;
         border-bottom: ${i < leads.length - 1 ? '1px solid var(--border)' : 'none'};
         text-decoration:none;
         transition:background var(--transition-fast);
       "
       onmouseenter="this.style.background='var(--bg-elevated)'"
       onmouseleave="this.style.background=''">

      <div style="display:flex;align-items:center;
                  justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px">
          <!-- Mini avatar -->
          <div style="
            width:30px;height:30px;
            background:var(--primary);
            border-radius:8px;
            display:flex;align-items:center;
            justify-content:center;
            font-size:11px;font-weight:700;
            color:#fff;flex-shrink:0;
            font-family:var(--font-display);
          ">${escapeHtml(getInitials(lead.name))}</div>
          <span style="
            font-size:var(--text-sm);
            font-weight:var(--weight-semibold);
            color:var(--text-primary);
          ">${escapeHtml(lead.name)}</span>
        </div>
        ${getStatusBadgeHTML(lead.status)}
      </div>

      <div style="display:flex;align-items:center;
                  justify-content:space-between;
                  padding-left:40px">
        <span style="font-size:var(--text-xs);color:var(--text-muted)">
          ${lead.company ? escapeHtml(lead.company) : 'No company'}
        </span>
        <span style="font-size:var(--text-xs);color:var(--text-muted)">
          ${timeAgo(lead.createdAt)}
        </span>
      </div>

    </a>
  `).join('');
}

// =====================================================
// STATUS BREAKDOWN CARDS
// =====================================================

/**
 * renderStatusBreakdown — Renders clickable status summary
 * cards at the bottom of the dashboard
 *
 * @param {object} byStatus - { New, Contacted, Qualified, Converted, Lost }
 */
function renderStatusBreakdown(byStatus) {
  const container = document.getElementById('status-breakdown');
  if (!container) return;

  const statuses = [
    { key: 'New',       icon: '🆕', color: 'var(--primary-light)' },
    { key: 'Contacted', icon: '📞', color: 'var(--accent)'        },
    { key: 'Qualified', icon: '⭐', color: 'var(--warning)'       },
    { key: 'Converted', icon: '✅', color: 'var(--success)'       },
    { key: 'Lost',      icon: '❌', color: 'var(--danger)'        },
  ];

  container.innerHTML = statuses.map(s => `
    <a href="/leads.html?status=${encodeURIComponent(s.key)}"
       style="
         display:flex;align-items:center;gap:12px;
         padding:16px;
         background:var(--bg-elevated);
         border:1px solid var(--border);
         border-radius:var(--radius-md);
         text-decoration:none;
         transition:all var(--transition-fast);
         cursor:pointer;
       "
       onmouseenter="this.style.borderColor='${s.color}';this.style.background='var(--bg-hover)'"
       onmouseleave="this.style.borderColor='var(--border)';this.style.background='var(--bg-elevated)'">
      <span style="font-size:1.4rem">${s.icon}</span>
      <div>
        <div style="
          font-family:var(--font-display);
          font-size:var(--text-xl);
          font-weight:var(--weight-extrabold);
          color:${s.color};
          line-height:1;
        ">${byStatus[s.key] || 0}</div>
        <div style="
          font-size:var(--text-xs);
          color:var(--text-muted);
          margin-top:2px;
        ">${escapeHtml(s.key)}</div>
      </div>
    </a>
  `).join('');
}