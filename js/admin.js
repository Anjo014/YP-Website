function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showMsg(el, text, type) {
  // Clear any existing message and its associated timeouts
  if (el.dataset.msgTimeout) {
    clearTimeout(el.dataset.msgTimeout);
    delete el.dataset.msgTimeout;
  }
  if (el.dataset.msgAnimationTimeout) {
    clearTimeout(el.dataset.msgAnimationTimeout);
    delete el.dataset.msgAnimationTimeout;
  }

  if (!text) {
    el.innerHTML = '';
    return;
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${type} animated-msg`;
  msgDiv.innerHTML = escapeHtml(text);
  el.innerHTML = ''; // Clear previous content
  el.appendChild(msgDiv);

  requestAnimationFrame(() => { msgDiv.classList.add('animate-in'); });

  const displayDuration = 3000; // 3 seconds
  const fadeDuration = 500; // 0.5 seconds, should match CSS transition duration

  el.dataset.msgTimeout = setTimeout(() => {
    msgDiv.classList.remove('animate-in');
    msgDiv.classList.add('animate-out');

    el.dataset.msgAnimationTimeout = setTimeout(() => {
      el.innerHTML = '';
      delete el.dataset.msgTimeout;
      delete el.dataset.msgAnimationTimeout;
    }, fadeDuration);
  }, displayDuration);
}

/* ---------------- Confirmation Modal ---------------- */
const confirmModal = {
  overlay: document.getElementById('confirmModalOverlay'),
  message: document.getElementById('confirmModalMessage'),
  confirmBtn: document.getElementById('confirmModalConfirmBtn'),
  cancelBtn: document.getElementById('confirmModalCancelBtn'),
  closeBtn: document.getElementById('confirmModalClose'),
  _onConfirm: null,

  show(message, onConfirmCallback) {
    this.message.textContent = message;
    this._onConfirm = onConfirmCallback;
    this.overlay.classList.add('open');
  },

  hide() {
    this.overlay.classList.remove('open');
    this._onConfirm = null;
  },

  init() {
    this.confirmBtn.addEventListener('click', () => { if (this._onConfirm) { this._onConfirm(); } this.hide(); });
    this.cancelBtn.addEventListener('click', () => this.hide());
    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.hide(); });
  }
};
confirmModal.init();

/* ---------------- Auth / view switching ---------------- */

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const headerUser = document.getElementById('headerUser');
const logoutLink = document.getElementById('logoutLink');

function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
  headerUser.style.display = 'inline';
  headerUser.textContent = `Signed in as ${localStorage.getItem('yp_name') || ''}`;
  logoutLink.style.display = 'inline';
  initDashboardData();
}

function showLogin() {
  loginView.style.display = 'block';
  dashboardView.style.display = 'none';
  headerUser.style.display = 'none';
  logoutLink.style.display = 'none';
}

if (Api.isLoggedIn()) showDashboard(); else showLogin();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  try {
    const data = await Api.post('login', { username, password });
    Api.setSession(data.token, data.name, data.username);
    showMsg(msg, '', '');
    showDashboard();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  try { await Api.post('logout'); } catch (_) {}
  Api.clearSession();
  showLogin();
});

document.getElementById('togglePasswordBtn').addEventListener('click', () => {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>` // Eye-off icon
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`; // Eye icon
});


/* ---------------- Tabs ---------------- */

document.querySelectorAll('.admin-tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');

    // Reload data for the activated tab
    switch (btn.dataset.tab) {
      case 'attendance':
        loadAttendancePanel();
        loadPastMeetings();
        loadTrashedMeetings();
        break;
      case 'minutes':
        loadMinutes();
        loadMinutesTrash();
        break;
      case 'announcements':
        loadAnnouncements();
        break;
      case 'photos':
        loadPhotos();
        break;
      case 'members':
        loadMembers();
        break;
      case 'coordinators':
        loadCoordinators();
        break;
      case 'statistics':
        loadStatistics();
        break;
    }
  });
});

/* ---------------- Init dashboard data ---------------- */

async function initDashboardData() {
  document.getElementById('attendanceDate').value = todayStr();
  document.getElementById('minutesDate').value = todayStr();
  document.getElementById('annDate').value = todayStr();
  document.getElementById('photoDate').value = todayStr();

  loadAttendancePanel();
  loadPastMeetings();
  loadTrashedMeetings();
  loadMinutes();
  loadMinutesTrash();
  loadAnnouncements();
  loadPhotos();
  loadMembers();
  loadCoordinators();
  loadStatistics();
}

/* ---------------- Attendance ---------------- */

let currentMembers = [];

async function loadAttendancePanel() {
  const list = document.getElementById('attendanceList');
  list.innerHTML = '<li class="empty-state">Loading members…</li>';
  try {
    currentMembers = await Api.get('getMembers');
    await renderAttendanceForDate();
  } catch (err) {
    list.innerHTML = `<li class="empty-state">${escapeHtml(err.message)}</li>`;
  }
}

async function renderAttendanceForDate() {
  const list = document.getElementById('attendanceList');
  if (!currentMembers.length) {
    list.innerHTML = '<li class="empty-state">No members yet — add members in the Members tab first.</li>';
    return;
  }
  list.innerHTML = currentMembers.map(m => `
    <li class="attendance-row" data-search="${escapeHtml(m.name.toLowerCase())}">
      <label>
        <input type="checkbox" data-id="${m.id}" data-name="${escapeHtml(m.name)}">
        ${escapeHtml(m.name)}
      </label>
    </li>
  `).join('');

  applyAttendanceSearch();
  updateAttendanceCount();
}

function updateAttendanceCount() {
  const total = document.querySelectorAll('#attendanceList input[type="checkbox"]').length;
  const checked = document.querySelectorAll('#attendanceList input[type="checkbox"]:checked').length;
  document.getElementById('attendanceCount').textContent = `${checked} of ${total} present`;
}

function applyAttendanceSearch() {
  const term = document.getElementById('attendanceSearch').value.trim().toLowerCase();
  document.querySelectorAll('#attendanceList .attendance-row').forEach(row => {
    const match = !term || row.dataset.search.includes(term);
    row.classList.toggle('hidden-by-search', !match);
  });
}

document.getElementById('attendanceSearch').addEventListener('input', applyAttendanceSearch);

document.getElementById('attendanceList').addEventListener('change', (e) => {
  if (e.target.type === 'checkbox') updateAttendanceCount();
});

document.getElementById('attendanceSelectAllBtn').addEventListener('click', () => {
  document.querySelectorAll('#attendanceList .attendance-row:not(.hidden-by-search) input[type="checkbox"]').forEach(cb => { cb.checked = true; });
  updateAttendanceCount();
});

document.getElementById('attendanceClearAllBtn').addEventListener('click', () => {
  document.querySelectorAll('#attendanceList .attendance-row:not(.hidden-by-search) input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  updateAttendanceCount();
});

document.getElementById('attendanceDate').addEventListener('change', () => {
  renderAttendanceForDate();
});

document.getElementById('saveAttendanceBtn').addEventListener('click', async () => {
  const msg = document.getElementById('attendanceMsg');
  const date = document.getElementById('attendanceDate').value;
  const checkboxes = document.querySelectorAll('#attendanceList input[type="checkbox"]');
  const records = Array.from(checkboxes).map(cb => ({
    memberId: cb.dataset.id,
    memberName: cb.dataset.name,
    present: cb.checked ? 'TRUE' : 'FALSE'
  }));
  try {
    await Api.post('saveAttendance', { date, records });
    showMsg(msg, 'Saved.', 'success');
    document.querySelectorAll('#attendanceList input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    updateAttendanceCount();
    loadPastMeetings();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

/* ---------------- Group 2: Records of attendance (tabs) ---------------- */

async function loadPastMeetings() {
  const wrap = document.getElementById('pastDatesList');
  try {
    const dates = await Api.get('getAttendanceDates');
    if (!dates.length) {
      wrap.innerHTML = '<div class="empty-state">No attendance recorded yet.</div>';
      return;
    }
    wrap.innerHTML = dates.map(d => `
      <div class="tab-pill">
        <button type="button" class="tab-label" data-date="${d}" data-action="viewDate">${d}</button>
        <button type="button" class="icon-btn edit" data-date="${d}" data-action="editDate" title="Edit ${d}" aria-label="Edit ${d}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
        <button type="button" class="icon-btn delete" data-date="${d}" data-action="trashDate" title="Delete ${d}" aria-label="Delete ${d}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
      </div>
    `).join('');
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('pastDatesList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const date = btn.dataset.date;

  if (btn.dataset.action === 'viewDate') openAttendanceViewModal(date);
  if (btn.dataset.action === 'editDate') openAttendanceModal(date);

  if (btn.dataset.action === 'trashDate') {
    confirmModal.show(`Delete attendance for ${date}? It will be moved to Deleted records, where you can recover it.`, async () => {
      try {
        await Api.post('deleteAttendanceForDate', { date });
        loadPastMeetings();
        loadTrashedMeetings();
      } catch (err) {
        alert(err.message);
      }
    });
  }
});

/* District Colors for Graph */
const districtColors = {
  'D1': 'var(--district-color-1)',
  'D2': 'var(--district-color-2)',
  'D3': 'var(--district-color-3)',
  'D4': 'var(--district-color-4)',
  'D5': 'var(--district-color-5)'
};

/* ---------------- Statistics ---------------- */

async function loadStatistics() {
  const cardsWrap = document.getElementById('statsCardsWrap');
  const recentComparisonWrap = document.getElementById('statsRecentComparisonWrap');
  const graphWrap = document.getElementById('statsGraphWrap');
  cardsWrap.innerHTML = '<div class="empty-state">Loading stats…</div>';
  recentComparisonWrap.innerHTML = '<div class="empty-state">Loading chart…</div>';
  graphWrap.innerHTML = '<div class="empty-state">Loading trends…</div>';

  try {
    const stats = await Api.get('getAttendanceStats');
    const allMonths = Object.keys(stats).sort(); // Sort chronologically

    if (allMonths.length === 0) {
      cardsWrap.innerHTML = '<div class="empty-state">No attendance data available to generate statistics.</div>';
      recentComparisonWrap.innerHTML = '<div class="empty-state">No attendance data available.</div>';
      graphWrap.innerHTML = '<div class="empty-state">No attendance data available to generate graph.</div>';
      return;
    }

    // Get all unique districts from current members for consistent graph display
    const allDistricts = [...new Set(currentMembers.map(m => m.district))].filter(Boolean).sort();

    // Render Cards (last two months)
    const lastTwoMonths = allMonths.slice(-2).reverse(); // Get last two, then reverse for display order
    let cardsHtml = '';
    lastTwoMonths.forEach(month => {
      const districtData = stats[month];
      const monthTotal = Object.values(districtData).reduce((sum, v) => sum + v, 0);

      cardsHtml += `
        <div class="stat-card">
          <h4>${new Date(month + '-02').toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</h4>
          <ul>
            ${allDistricts.map(d => `<li><span>${d}</span> <strong>${districtData[d] || 0}</strong></li>`).join('')}
            <li style="background:var(--skylight);"><span><strong>Total</strong></span> <strong>${monthTotal}</strong></li>
          </ul>
        </div>
      `;
    });
    cardsWrap.innerHTML = cardsHtml;

    // --- Reusable Line Graph Renderer ---
    const renderLineGraph = (targetWrap, monthsToShow) => {
      const graphMonths = allMonths.slice(-monthsToShow);
      if (graphMonths.length < 2) {
        targetWrap.innerHTML = `<div class="empty-state">Not enough data to generate a line graph (need at least 2 months).</div>`;
        return;
      }

      let maxAttendanceValue = 0;
      graphMonths.forEach(month => {
        Object.values(stats[month]).forEach(count => {
          if (count > maxAttendanceValue) maxAttendanceValue = count;
        });
      });
      maxAttendanceValue = Math.ceil(maxAttendanceValue / 10) * 10;
      if (maxAttendanceValue === 0) maxAttendanceValue = 10;

      const svgWidth = 1000, svgHeight = 250, padding = 30;
      const innerWidth = svgWidth - 2 * padding, innerHeight = svgHeight - 2 * padding;
      let svgContent = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">`;

      const numYLabels = 5;
      for (let i = 0; i <= numYLabels; i++) {
        const yValue = (maxAttendanceValue / numYLabels) * i;
        const y = svgHeight - padding - (yValue / maxAttendanceValue) * innerHeight;
        svgContent += `<line x1="${padding}" y1="${y}" x2="${svgWidth - padding}" y2="${y}" class="grid-line" />`;
        svgContent += `<text x="${padding - 5}" y="${y + 4}" text-anchor="end" class="axis-label">${yValue}</text>`;
      }

      const monthStep = innerWidth / (graphMonths.length - 1);
      graphMonths.forEach((month, i) => {
        const x = padding + i * monthStep;
        const monthLabel = new Date(month + '-02').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        svgContent += `<text x="${x}" y="${svgHeight - padding + 15}" text-anchor="middle" class="axis-label">${monthLabel}</text>`;
      });

      allDistricts.forEach(district => {
        const points = graphMonths.map((month, i) => {
          const attendance = stats[month]?.[district] || 0;
          const x = padding + i * monthStep;
          const y = svgHeight - padding - (attendance / maxAttendanceValue) * innerHeight;
          return `${x},${y}`;
        }).join(' ');
        svgContent += `<polyline points="${points}" class="line-chart-line" style="stroke:${districtColors[district] || 'gray'};" />`;
        graphMonths.forEach((month, i) => {
          const attendance = stats[month]?.[district] || 0;
          const x = padding + i * monthStep;
          const y = svgHeight - padding - (attendance / maxAttendanceValue) * innerHeight;
          svgContent += `<circle cx="${x}" cy="${y}" r="4" class="data-point" style="fill:${districtColors[district] || 'gray'};" title="${district} ${new Date(month + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${attendance}" />`;
        });
      });

      svgContent += `</svg>`;

      targetWrap.innerHTML = `
        <div class="stats-graph-container">
          <div class="stats-graph-legend">
            ${allDistricts.map((d) => `
              <div class="legend-item">
                <span class="legend-color-box" style="background:${districtColors[d] || 'gray'};"></span>
                <span>${d}</span>
              </div>
            `).join('')}
          </div>
          <div class="stats-graph">
            <span class="graph-y-axis-label">Attendance Count</span>
            ${svgContent}
          </div>
        </div>
      `;

      setTimeout(() => {
        targetWrap.querySelectorAll('.line-chart-line').forEach(line => {
          const length = line.getTotalLength();
          line.style.strokeDasharray = length;
          line.style.strokeDashoffset = length;
          line.getBoundingClientRect(); // Force reflow
          line.style.strokeDashoffset = 0;
        });
      }, 100);
    };

    // Render the two graphs
    renderLineGraph(recentComparisonWrap, 2); // Recent comparison (last 2 months)
    renderLineGraph(graphWrap, 12); // Yearly trend (last 12 months)

  } catch (err) {
    cardsWrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    recentComparisonWrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    graphWrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- Group 3: Deleted records (tabs) ---------------- */

async function loadTrashedMeetings() {
  const wrap = document.getElementById('trashedDatesList');
  try {
    const dates = await Api.get('getTrashedDates');
    if (!dates.length) {
      wrap.innerHTML = '<div class="empty-state">No deleted records.</div>';
      return;
    }
    wrap.innerHTML = dates.map(d => `
      <div class="tab-pill">
        <span class="tab-label" style="cursor:default;">${d}</span>
        <button type="button" class="text-btn recover" data-date="${d}" data-action="restoreDate">Recover</button>
        <button type="button" class="text-btn purge" data-date="${d}" data-action="purgeDate">Delete permanently</button>
      </div>
    `).join('');
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('trashedDatesList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const date = btn.dataset.date;

  if (btn.dataset.action === 'restoreDate') {
    try {
      await Api.post('restoreAttendanceForDate', { date });
      loadTrashedMeetings();
      loadPastMeetings();
    } catch (err) {
      alert(err.message);
    }
  }

  if (btn.dataset.action === 'purgeDate') {
    confirmModal.show(`Permanently delete attendance for ${date}? This can't be undone.`, async () => {
      try {
        await Api.post('permanentlyDeleteAttendanceForDate', { date });
        loadTrashedMeetings();
      } catch (err) {
        alert(err.message);
      }
    });
  }
});

/* ---------------- View modal (read-only, with Edit / Close) ---------------- */

const attendanceViewModalOverlay = document.getElementById('attendanceViewModalOverlay');
let viewModalDate = null;

function closeAttendanceViewModal() {
  attendanceViewModalOverlay.classList.remove('open');
  viewModalDate = null;
}

async function openAttendanceViewModal(date) {
  viewModalDate = date;
  document.getElementById('attendanceViewModalTitle').textContent = `Attendance — ${date}`;
  attendanceViewModalOverlay.classList.add('open');

  const list = document.getElementById('attendanceViewModalList');
  list.innerHTML = '<li class="empty-state">Loading…</li>';
  try {
    const records = await Api.get('getAttendance', { date });
    if (!records.length) {
      list.innerHTML = '<li class="empty-state">No attendees recorded for this date.</li>';
      return;
    }
    list.innerHTML = records.map(r => {
      const present = r.present === 'TRUE' || r.present === true;
      return `
        <li class="attendance-row">
          <span>${escapeHtml(r.memberName)}</span>
          <span class="pill ${present ? 'yes' : 'no'}">${present ? 'Present' : 'Absent'}</span>
        </li>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = `<li class="empty-state">${escapeHtml(err.message)}</li>`;
  }
}

document.getElementById('attendanceViewModalClose').addEventListener('click', closeAttendanceViewModal);
document.getElementById('attendanceViewModalCloseBtn').addEventListener('click', closeAttendanceViewModal);
document.getElementById('attendanceViewModalEditBtn').addEventListener('click', () => {
  const date = viewModalDate;
  closeAttendanceViewModal();
  openAttendanceModal(date);
});
attendanceViewModalOverlay.addEventListener('click', (e) => {
  if (e.target === attendanceViewModalOverlay) closeAttendanceViewModal();
});

/* ---------------- Attendance edit modal (add / edit / delete specific attendees) ---------------- */

let modalDate = null;
let modalRecords = []; // { id (optional), memberId, memberName, present }

const attendanceModalOverlay = document.getElementById('attendanceModalOverlay');

function closeAttendanceModal() {
  attendanceModalOverlay.classList.remove('open');
  modalDate = null;
  modalRecords = [];
}

async function openAttendanceModal(date) {
  modalDate = date;
  document.getElementById('attendanceModalTitle').textContent = `Attendance — ${date}`;
  document.getElementById('attendanceModalMsg').innerHTML = '';
  attendanceModalOverlay.classList.add('open');

  const list = document.getElementById('attendanceModalList');
  list.innerHTML = '<li class="empty-state">Loading…</li>';
  try {
    if (!currentMembers.length) currentMembers = await Api.get('getMembers');
    const existing = await Api.get('getAttendance', { date });
    modalRecords = existing.map(r => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      present: r.present === 'TRUE' || r.present === true
    }));
    renderAttendanceModalList();
  } catch (err) {
    list.innerHTML = `<li class="empty-state">${escapeHtml(err.message)}</li>`;
  }
}

function renderAttendanceModalList() {
  const list = document.getElementById('attendanceModalList');
  if (!modalRecords.length) {
    list.innerHTML = '<li class="empty-state">No attendees recorded for this date yet — add one below.</li>';
  } else {
    list.innerHTML = modalRecords.sort((a, b) => a.memberName.localeCompare(b.memberName)).map((r, i) => `
      <li class="attendance-row" data-search="${escapeHtml(r.memberName.toLowerCase())}">
        <label>
          <input type="checkbox" data-index="${i}" class="modal-present-checkbox" ${r.present ? 'checked' : ''}>
          ${escapeHtml(r.memberName)}
        </label>
      </li>
    `).join('');
  }

  applyAttendanceModalSearch();
}

function applyAttendanceModalSearch() {
  const term = document.getElementById('attendanceModalSearch').value.trim().toLowerCase();
  document.querySelectorAll('#attendanceModalList .attendance-row').forEach(row => {
    row.style.display = !term || row.dataset.search.includes(term) ? '' : 'none';
  });
}

document.getElementById('attendanceModalList').addEventListener('change', (e) => {
  if (e.target.classList.contains('modal-present-checkbox')) {
    const i = Number(e.target.dataset.index);
    modalRecords[i].present = e.target.checked;
  }
});

document.getElementById('attendanceModalSearch').addEventListener('input', applyAttendanceModalSearch);

document.getElementById('attendanceModalSaveBtn').addEventListener('click', async () => {
  const msg = document.getElementById('attendanceModalMsg');
  const records = modalRecords.map(r => ({
    memberId: r.memberId,
    memberName: r.memberName,
    present: r.present ? 'TRUE' : 'FALSE'
  }));
  try {
    await Api.post('saveAttendance', { date: modalDate, records });
    showMsg(msg, 'Saved.', 'success');
    if (document.getElementById('attendanceDate').value === modalDate) renderAttendanceForDate();
    loadPastMeetings();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

document.getElementById('attendanceModalClose').addEventListener('click', closeAttendanceModal);
document.getElementById('attendanceModalCloseBtn').addEventListener('click', closeAttendanceModal);
attendanceModalOverlay.addEventListener('click', (e) => {
  if (e.target === attendanceModalOverlay) closeAttendanceModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && attendanceModalOverlay.classList.contains('open')) closeAttendanceModal();
});

/* ---------------- Minutes ---------------- */

async function loadMinutes() {
  const wrap = document.getElementById('minutesListWrap');
  try {
    const items = await Api.get('getMinutes');
    wrap.innerHTML = items.length ? items.map(m => `
      <div style="padding:12px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:12px;">
        <div>
          <div class="meta" style="font-size:0.82rem; color:var(--ink-soft);">${m.date} &middot; recorded by ${escapeHtml(m.recordedBy)}</div>
          <strong style="cursor:pointer;" data-id="${m.id}" data-action="viewMinutes">TITLE: ${escapeHtml(m.title)}</strong>
        </div>
        <div class="row-actions" style="height:fit-content;">
          <button type="button" class="icon-btn edit" data-id="${m.id}" data-action="editMinutes" title="Edit" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
          <button type="button" class="icon-btn delete" data-id="${m.id}" data-action="trashMinutes" title="Delete" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
      </div>
    `).join('') : '<p class="empty-state">No minutes recorded yet.</p>';
  } catch (err) {
    wrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  }
}

async function loadMinutesTrash() {
  const wrap = document.getElementById('minutesTrashWrap');
  try {
    const items = await Api.get('getTrashedMinutes');
    wrap.innerHTML = items.length ? `<div class="tab-row">` + items.map(m => `
      <div class="tab-pill">
        <span class="tab-label" style="cursor:default;">${escapeHtml(m.title)}</span>
        <button type="button" class="text-btn recover" data-id="${m.id}" data-action="restoreMinutes">Recover</button>
        <button type="button" class="text-btn purge" data-id="${m.id}" data-action="purgeMinutes">Delete permanently</button>
      </div>
    `).join('') + `</div>` : '<div class="empty-state">No deleted minutes.</div>';
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('minutesForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('minutesMsg');
  try {
    await Api.post('addMinutes', {
      date: document.getElementById('minutesDate').value,
      title: document.getElementById('minutesTitle').value,
      content: document.getElementById('minutesContent').value
    });
    e.target.reset();
    document.getElementById('minutesDate').value = todayStr();
    showMsg(msg, 'Minutes saved.', 'success');
    loadMinutes();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

document.getElementById('minutesListWrap').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;

  if (el.dataset.action === 'viewMinutes') openMinutesViewModal(id);
  if (el.dataset.action === 'editMinutes') openMinutesEditModal(id);

  if (el.dataset.action === 'trashMinutes') {
    confirmModal.show('Delete these minutes? They will be moved to Deleted minutes, where you can recover them.', async () => {
      try {
        await Api.post('deleteMinutes', { id });
        loadMinutes();
        loadMinutesTrash();
      } catch (err) {
        alert(err.message);
      }
    });
  }
});

document.getElementById('minutesTrashWrap').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === 'restoreMinutes') {
    try {
      await Api.post('restoreMinutes', { id });
      loadMinutesTrash();
      loadMinutes();
    } catch (err) {
      alert(err.message);
    }
  }

  if (btn.dataset.action === 'purgeMinutes') {
    confirmModal.show('Permanently delete these minutes? This can\'t be undone.', async () => {
      try {
        await Api.post('permanentlyDeleteMinutes', { id });
        loadMinutesTrash();
      } catch (err) {
        alert(err.message);
      }
    });
  }
});

/* Minutes view modal */
const minutesViewModalOverlay = document.getElementById('minutesViewModalOverlay');
let minutesViewId = null;

function closeMinutesViewModal() { minutesViewModalOverlay.classList.remove('open'); minutesViewId = null; }

async function openMinutesViewModal(id) {
  minutesViewId = id;
  minutesViewModalOverlay.classList.add('open');
  document.getElementById('minutesViewModalTitle').textContent = 'Loading…';
  document.getElementById('minutesViewModalMeta').textContent = '';
  document.getElementById('minutesViewModalContent').textContent = '';
  try {
    const items = await Api.get('getMinutes');
    const m = items.find(x => x.id === id);
    if (!m) throw new Error('Minutes not found');
    document.getElementById('minutesViewModalTitle').textContent = m.title;
    document.getElementById('minutesViewModalMeta').textContent = `${m.date} · recorded by ${m.recordedBy}`;
    document.getElementById('minutesViewModalContent').textContent = m.content;
  } catch (err) {
    document.getElementById('minutesViewModalTitle').textContent = 'Error';
    document.getElementById('minutesViewModalContent').textContent = err.message;
  }
}

document.getElementById('minutesViewModalClose').addEventListener('click', closeMinutesViewModal);
document.getElementById('minutesViewModalCloseBtn').addEventListener('click', closeMinutesViewModal);
document.getElementById('minutesViewModalEditBtn').addEventListener('click', () => {
  const id = minutesViewId;
  closeMinutesViewModal();
  openMinutesEditModal(id);
});
minutesViewModalOverlay.addEventListener('click', (e) => { if (e.target === minutesViewModalOverlay) closeMinutesViewModal(); });

/* Minutes edit modal */
const minutesEditModalOverlay = document.getElementById('minutesEditModalOverlay');
let minutesEditId = null;

function closeMinutesEditModal() { minutesEditModalOverlay.classList.remove('open'); minutesEditId = null; }

async function openMinutesEditModal(id) {
  minutesEditId = id;
  minutesEditModalOverlay.classList.add('open');
  document.getElementById('minutesEditModalMsg').innerHTML = '';
  try {
    const items = await Api.get('getMinutes');
    const m = items.find(x => x.id === id);
    if (!m) throw new Error('Minutes not found');
    document.getElementById('minutesEditDate').value = m.date;
    document.getElementById('minutesEditTitle').value = m.title;
    document.getElementById('minutesEditContent').value = m.content;
  } catch (err) {
    showMsg(document.getElementById('minutesEditModalMsg'), err.message, 'error');
  }
}

document.getElementById('minutesEditModalClose').addEventListener('click', closeMinutesEditModal);
document.getElementById('minutesEditModalCloseBtn').addEventListener('click', closeMinutesEditModal);
minutesEditModalOverlay.addEventListener('click', (e) => { if (e.target === minutesEditModalOverlay) closeMinutesEditModal(); });

document.getElementById('minutesEditModalSaveBtn').addEventListener('click', async () => {
  const msg = document.getElementById('minutesEditModalMsg');
  try {
    await Api.post('updateMinutes', {
      id: minutesEditId,
      date: document.getElementById('minutesEditDate').value,
      title: document.getElementById('minutesEditTitle').value,
      content: document.getElementById('minutesEditContent').value
    });
    closeMinutesEditModal();
    loadMinutes();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

/* ---------------- Announcements ---------------- */

async function loadAnnouncements() {
  const wrap = document.getElementById('announcementsListWrap');
  try {
    const items = await Api.get('getAnnouncements');
    wrap.innerHTML = items.length ? items.map(a => {
      const isHidden = a.hidden === true || a.hidden === 'TRUE';
      return `
      <div style="padding:12px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:12px; ${isHidden ? 'opacity: 0.6;' : ''}">
        <div>
          <div class="meta" style="font-size:0.82rem; color:var(--ink-soft);">${a.date} &middot; ${escapeHtml(a.postedBy)}</div>
          ${a.eventDate ? `<div class="meta" style="font-size:0.82rem; color:var(--ember-dark);">Event on: ${a.eventDate}</div>` : ''}
          <strong>${escapeHtml(a.title)} ${isHidden ? '(Hidden)' : ''}</strong>
          <p style="margin:6px 0 0; white-space: pre-wrap;">${escapeHtml(a.content)}</p>
          ${a.link ? `<a href="${a.link}" target="_blank" rel="noopener noreferrer" class="btn" style="margin-top:12px; padding: 6px 16px; font-size: 0.9rem;">Go to Link</a>` : ''}
        </div>
        <div class="row-actions" style="height:fit-content; display:flex; gap: 4px;">
          <button type="button" class="icon-btn edit" data-id="${a.id}" data-action="editAnnouncement" title="Edit" aria-label="Edit"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
          <button type="button" class="icon-btn delete" data-id="${a.id}" data-action="deleteAnnouncement" title="Delete" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
      </div>
    `}).join('') : '<p class="empty-state">No announcements posted yet.</p>';
  } catch (err) {
    wrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById('announcementForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('announcementMsg');
  try {
    await Api.post('addAnnouncement', {
      date: document.getElementById('annDate').value,
      title: document.getElementById('annTitle').value,
      content: document.getElementById('annContent').value,
      eventDate: document.getElementById('annEventDate').value,
      link: document.getElementById('annLink').value
    });
    e.target.reset();
    document.getElementById('annDate').value = todayStr();
    showMsg(msg, 'Announcement posted.', 'success');
    loadAnnouncements();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

document.getElementById('announcementsListWrap').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'deleteAnnouncement') {
    confirmModal.show('Delete this announcement?', async () => {
      try {
        await Api.post('deleteAnnouncement', { id: btn.dataset.id });
        loadAnnouncements();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (btn.dataset.action === 'editAnnouncement') {
    openAnnouncementEditModal(btn.dataset.id);
  }

  if (btn.dataset.action === 'toggleVisibility') {
    const announcementId = btn.dataset.id;
    const items = await Api.get('getAnnouncements');
    const announcement = items.find(a => a.id === announcementId);
    if (!announcement) return;

    const currentlyHidden = announcement.hidden === true || announcement.hidden === 'TRUE';
    try {
      await Api.post('updateAnnouncement', { id: announcementId, ...announcement, hidden: !currentlyHidden });
      loadAnnouncements();
    } catch (err) {
      alert(`Could not toggle visibility: ${err.message}`);
    }
  }
});

/* Announcement edit modal */
const announcementEditModalOverlay = document.getElementById('announcementEditModalOverlay');
let announcementEditId = null;

function closeAnnouncementEditModal() { announcementEditModalOverlay.classList.remove('open'); announcementEditId = null; }

async function openAnnouncementEditModal(id) {
  announcementEditId = id;
  announcementEditModalOverlay.classList.add('open');
  document.getElementById('announcementEditModalMsg').innerHTML = '';
  try {
    const items = await Api.get('getAnnouncements');
    const a = items.find(x => x.id === id);
    if (!a) throw new Error('Announcement not found');
    document.getElementById('annEditDate').value = a.date;
    document.getElementById('annEditTitle').value = a.title;
    document.getElementById('annEditEventDate').value = a.eventDate || '';
    document.getElementById('annEditLink').value = a.link || '';
    document.getElementById('annEditContent').value = a.content;
    document.getElementById('annEditHidden').checked = a.hidden === true || a.hidden === 'TRUE';
  } catch (err) {
    showMsg(document.getElementById('announcementEditModalMsg'), err.message, 'error');
  }
}

document.getElementById('announcementEditModalClose').addEventListener('click', closeAnnouncementEditModal);
document.getElementById('announcementEditModalCloseBtn').addEventListener('click', closeAnnouncementEditModal);
announcementEditModalOverlay.addEventListener('click', (e) => { if (e.target === announcementEditModalOverlay) closeAnnouncementEditModal(); });

document.getElementById('announcementEditModalSaveBtn').addEventListener('click', async () => {
  const msg = document.getElementById('announcementEditModalMsg');
  try {
    await Api.post('updateAnnouncement', {
      id: announcementEditId,
      date: document.getElementById('annEditDate').value,
      title: document.getElementById('annEditTitle').value,
      content: document.getElementById('annEditContent').value,
      eventDate: document.getElementById('annEditEventDate').value,
      link: document.getElementById('annEditLink').value,
      hidden: document.getElementById('annEditHidden').checked
    });
    closeAnnouncementEditModal();
    loadAnnouncements();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

/* ---------------- Photos ---------------- */

function toDriveImageUrl(url) {
  if (!url) return '';
  const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/); // Google Drive file IDs are long
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url; // Return original URL if it's not a standard Drive link
}

async function loadPhotos() {
  const grid = document.getElementById('adminGalleryGrid');
  try {
    const items = await Api.get('getPhotos');
    grid.innerHTML = items.length ? `<div class="admin-gallery-grid">` + items.map(p => `
      <div class="gallery-card">
        <img src="${toDriveImageUrl(p.url)}" alt="${escapeHtml(p.caption || '')}" loading="lazy">
        <div class="cap" style="display:flex; justify-content:space-between; align-items:center; gap: 8px;">
          <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.caption || p.date)}</span>
          <button type="button" class="icon-btn edit" data-id="${p.id}" data-caption="${escapeHtml(p.caption || '')}" data-action="editPhotoCaption" title="Edit Caption" aria-label="Edit Caption"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>
          <button type="button" class="icon-btn delete" data-id="${p.id}" data-action="deletePhoto" title="Delete" aria-label="Delete"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
      </div>
    `).join('') + `</div>` : '<div class="empty-state">No photos yet.</div>';
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('photoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('photoMsg');
  try {
    await Api.post('addPhoto', {
      date: document.getElementById('photoDate').value,
      url: document.getElementById('photoUrl').value,
      caption: document.getElementById('photoCaption').value
    });
    e.target.reset();
    document.getElementById('photoDate').value = todayStr();
    showMsg(msg, 'Photo added.', 'success');
    loadPhotos();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});
document.getElementById('adminGalleryGrid').addEventListener('click', async (e) => {
  const target = e.target;

  if (target.tagName === 'IMG') {
    const photoModal = {
      overlay: document.getElementById('photoModalOverlay'),
      image: document.getElementById('photoModalImage'),
      caption: document.getElementById('photoModalCaption'),
      open(src, alt) {
        this.image.src = src;
        this.image.alt = alt;
        this.caption.textContent = alt;
        this.overlay.classList.add('open');
      },
      close() { this.overlay.classList.remove('open'); }
    };
    photoModal.overlay.addEventListener('click', () => photoModal.close());
    photoModal.open(target.src, target.alt);
    return;
  }

  const deleteBtn = target.closest('[data-action="deletePhoto"]');
  if (deleteBtn) {
    confirmModal.show('Delete this photo?', async () => {
      try {
        await Api.post('deletePhoto', { id: deleteBtn.dataset.id });
        loadPhotos();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const editBtn = target.closest('[data-action="editPhotoCaption"]');
  if (editBtn) {
    const id = editBtn.dataset.id;
    const caption = editBtn.dataset.caption;
    photoCaptionModal.open(id, caption);
  }
});

/* Photo Caption Edit Modal Logic */
const photoCaptionModal = {
  overlay: document.getElementById('photoCaptionModalOverlay'),
  input: document.getElementById('photoCaptionModalInput'),
  msg: document.getElementById('photoCaptionModalMsg'),
  _id: null,
  open(id, currentCaption) {
    this._id = id;
    this.input.value = currentCaption;
    this.msg.innerHTML = '';
    this.overlay.classList.add('open');
  },
  close() {
    this.overlay.classList.remove('open');
    this._id = null;
  },
  async save() {
    if (!this._id) return;
    try {
      await Api.post('updatePhotoCaption', { id: this._id, caption: this.input.value });
      this.close();
      loadPhotos();
    } catch (err) {
      showMsg(this.msg, err.message, 'error');
    }
  }
};

document.getElementById('photoCaptionModalClose').addEventListener('click', () => photoCaptionModal.close());
document.getElementById('photoCaptionModalCloseBtn').addEventListener('click', () => photoCaptionModal.close());
document.getElementById('photoCaptionModalSaveBtn').addEventListener('click', () => photoCaptionModal.save());
photoCaptionModal.overlay.addEventListener('click', (e) => { if (e.target === photoCaptionModal.overlay) photoCaptionModal.close(); });

/* ---------------- Members ---------------- */

async function loadMembers() {
  const body = document.getElementById('membersTableBody');
  try {
    const items = await Api.get('getMembers');
    currentMembers = items;
    body.innerHTML = items.length ? items.map(m => `
      <tr>
        <td><a href="#" data-id="${m.id}" data-action="editMember" style="font-weight:600;">${escapeHtml(m.name)}</a></td>
        <td>${escapeHtml(m.district || '')}</td>
        <td style="text-align:right;"><button type="button" class="icon-btn remove" data-id="${m.id}" data-action="removeMember" title="Remove" aria-label="Remove"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td>
      </tr>
    `).join('') : '<tr><td colspan="3" class="empty-state">No members yet. Click "Add Member" to start.</td></tr>';
  } catch (err) {
    body.innerHTML = `<tr><td colspan="3" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

/* Member Modal Logic */
const memberModalOverlay = document.getElementById('memberModalOverlay');
const memberModalForm = document.getElementById('memberModalForm');
let memberEditId = null;

function closeMemberModal() {
  memberModalOverlay.classList.remove('open');
  memberModalForm.reset();
  memberEditId = null;
}

function openMemberAddModal() {
  memberEditId = null;
  memberModalForm.reset();
  document.getElementById('memberModalTitle').textContent = 'Add Member';
  document.getElementById('memberModalMsg').innerHTML = '';
  memberModalOverlay.classList.add('open');
}

function openMemberEditModal(id) {
  memberEditId = id;
  const member = currentMembers.find(m => m.id === id);
  if (!member) {
    alert('Could not find member data.');
    return;
  }
  document.getElementById('memberModalTitle').textContent = 'Edit Member';
  document.getElementById('memberModalMsg').innerHTML = '';

  document.getElementById('memberModalName').value = member.name || '';
  document.getElementById('memberModalDistrict').value = member.district || '';
  document.getElementById('memberModalAge').value = member.age || '';
  document.getElementById('memberModalGradeLevel').value = member.gradeLevel || '';
  document.getElementById('memberModalSchool').value = member.school || '';
  document.getElementById('memberModalContact').value = member.contactNumber || '';

  memberModalOverlay.classList.add('open');
}

document.getElementById('addMemberBtn').addEventListener('click', openMemberAddModal);

document.getElementById('memberModalSaveBtn').addEventListener('click', async () => {
  const msg = document.getElementById('memberModalMsg');
  const name = document.getElementById('memberModalName').value;
  const district = document.getElementById('memberModalDistrict').value;

  if (!name.trim()) {
    showMsg(msg, 'Full Name is required.', 'error');
    return;
  }

  if (!district) {
    showMsg(msg, 'District is required.', 'error');
    return;
  }

  const payload = {
    name: name,
    district: district,
    age: document.getElementById('memberModalAge').value,
    gradeLevel: document.getElementById('memberModalGradeLevel').value,
    school: document.getElementById('memberModalSchool').value,
    contactNumber: document.getElementById('memberModalContact').value
  };

  try {
    if (memberEditId) {
      // This is an update
      await Api.post('updateMember', { id: memberEditId, ...payload });
      showMsg(document.getElementById('memberMsg'), 'Member updated.', 'success');
    } else {
      // This is a new member
      await Api.post('addMember', payload);
      showMsg(document.getElementById('memberMsg'), 'Member added.', 'success');
    }
    closeMemberModal();
    loadMembers();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

document.getElementById('memberModalClose').addEventListener('click', closeMemberModal);
document.getElementById('memberModalCloseBtn').addEventListener('click', closeMemberModal);
memberModalOverlay.addEventListener('click', (e) => {
  if (e.target === memberModalOverlay) closeMemberModal();
});

document.getElementById('membersTableBody').addEventListener('click', async (e) => {
  const actionTarget = e.target.closest('[data-action]');
  if (!actionTarget) return;

  e.preventDefault();
  const action = actionTarget.dataset.action;
  const id = actionTarget.dataset.id;

  if (action === 'editMember') {
    openMemberEditModal(id);
  }

  if (action === 'removeMember') {
    confirmModal.show('Remove this member?', async () => {
      try {
        // Prevent removing the last member
        if (currentMembers.length === 1) throw new Error('Cannot remove the last member.');
        await Api.post('removeMember', { id });
        loadMembers();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const editBtn = target.closest('[data-action="editPhotoCaption"]');
  if (editBtn) {
    const id = editBtn.dataset.id;
    const caption = editBtn.dataset.caption;
    photoCaptionModal.open(id, caption);
  }
});

/* ---------------- Coordinators ---------------- */

async function loadCoordinators() {
  const body = document.getElementById('coordinatorsTableBody');
  try {
    const items = await Api.get('getCoordinators');
    const currentUser = localStorage.getItem('yp_username');
    body.innerHTML = items.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.username)}</td>
        <td style="text-align:right; display:flex; justify-content:flex-end; gap:4px;">
          <button type="button" class="icon-btn edit" data-action="editCoordinator" 
            ${c.username !== currentUser ? 'disabled title="You can only edit your own account."' : 'title="Edit my account"'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
          <button type="button" class="icon-btn remove" data-id="${c.id}" data-action="removeCoordinator" title="Remove" aria-label="Remove"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="3" class="empty-state">${escapeHtml(err.message)}</td></tr>`;
  }
}

document.getElementById('coordinatorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('coordinatorMsg');
  try {
    await Api.post('addCoordinator', {
      name: document.getElementById('coordName').value,
      username: document.getElementById('coordUsername').value,
      password: document.getElementById('coordPassword').value
    });
    e.target.reset();
    showMsg(msg, 'Coordinator added.', 'success');
    loadCoordinators();
  } catch (err) {
    showMsg(msg, err.message, 'error');
  }
});

document.getElementById('coordinatorsTableBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'removeCoordinator') {
    confirmModal.show('Remove this coordinator account?', async () => {
      try {
        await Api.post('removeCoordinator', { id: btn.dataset.id });
        loadCoordinators();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (btn.dataset.action === 'editCoordinator') {
    openCoordinatorEditModal();
  }
});

/* Coordinator Edit Modal */
const coordinatorEditModal = {
  overlay: document.getElementById('coordinatorEditModalOverlay'),
  msg: document.getElementById('coordinatorEditModalMsg'),
  nameInput: document.getElementById('coordinatorEditName'),
  usernameInput: document.getElementById('coordinatorEditUsername'),
  detailsForm: document.getElementById('coordinatorEditForm'),
  passwordForm: document.getElementById('coordinatorPasswordForm'),

  open() {
    this.msg.innerHTML = '';
    this.detailsForm.reset();
    this.passwordForm.reset();
    this.nameInput.value = localStorage.getItem('yp_name') || '';
    this.usernameInput.value = localStorage.getItem('yp_username') || '';
    this.overlay.classList.add('open');
  },
  close() {
    this.overlay.classList.remove('open');
  }
};

function openCoordinatorEditModal() {
  coordinatorEditModal.open();
}

document.getElementById('coordinatorEditModalClose').addEventListener('click', () => coordinatorEditModal.close());
document.getElementById('coordinatorEditModalCloseBtn').addEventListener('click', () => coordinatorEditModal.close());
coordinatorEditModal.overlay.addEventListener('click', (e) => { if (e.target === coordinatorEditModal.overlay) coordinatorEditModal.close(); });

document.getElementById('coordinatorEditForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = coordinatorEditModal.nameInput.value;
  const username = coordinatorEditModal.usernameInput.value;
  try {
    const data = await Api.post('updateMyAccount', { name, username });
    Api.setSession(Api.token(), data.newName, data.newUsername);
    showMsg(coordinatorEditModal.msg, 'Account details updated.', 'success');
    headerUser.textContent = `Signed in as ${data.newName}`;
    loadCoordinators(); // Refresh list to reflect new name/username
  } catch (err) {
    showMsg(coordinatorEditModal.msg, err.message, 'error');
  }
});

document.getElementById('coordinatorPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (newPassword !== confirmPassword) {
    return showMsg(coordinatorEditModal.msg, 'New passwords do not match.', 'error');
  }
  try {
    await Api.post('changeMyPassword', { currentPassword, newPassword });
    showMsg(coordinatorEditModal.msg, 'Password changed successfully.', 'success');
    e.target.reset();
  } catch (err) {
    showMsg(coordinatorEditModal.msg, err.message, 'error');
  }
});