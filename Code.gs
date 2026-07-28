/**
 * Young People's Ministry Website — Backend (Google Apps Script)
 * -----------------------------------------------------------------
 * Deploy this as a Web App ("Execute as: Me", "Who has access: Anyone").
 * The Sheet this script is bound to becomes your database.
 * See ../README.md for full setup steps.
 */

const SHEETS = {
  COORDINATORS: 'Coordinators',
  MEMBERS: 'Members',
  ATTENDANCE: 'Attendance',
  MINUTES: 'Minutes',
  ANNOUNCEMENTS: 'Announcements',
  PHOTOS: 'Photos',
  SESSIONS: 'Sessions'
};

const SESSION_LENGTH_MS = 8 * 60 * 60 * 1000; // 8 hours

const SHEET_HEADERS = {
  Coordinators: ['id', 'username', 'passwordHash', 'salt', 'name', 'createdAt'],
  Members: ['id', 'name', 'active', 'addedAt', 'district', 'age', 'gradeLevel', 'school', 'contactNumber'],
  Attendance: ['id', 'date', 'memberId', 'memberName', 'present', 'recordedBy', 'recordedAt', 'trashed'],
  Minutes: ['id', 'date', 'title', 'content', 'recordedBy', 'recordedAt', 'trashed'],
  Announcements: ['id', 'date', 'title', 'content', 'postedBy', 'postedAt', 'eventDate'],
  Photos: ['id', 'date', 'url', 'caption', 'postedBy', 'postedAt'],
  Sessions: ['token', 'username', 'name', 'expiresAt']
};

/* ============================= ENTRY POINTS ============================= */

function doGet(e) {
  try {
    ensureSchema();
    const action = e.parameter.action;
    let result;
    switch (action) {
      case 'ping':
        result = { ok: true, time: new Date().toISOString() };
        break;
      case 'getAnnouncements':
        result = getAnnouncements();
        break;
      case 'getPhotos':
        result = getPhotos();
        break;
      case 'getMembers':
        requireAuth(e.parameter.token);
        result = getMembers();
        break;
      case 'getAttendance':
        requireAuth(e.parameter.token);
        result = getAttendanceForDate(e.parameter.date);
        break;
      case 'getAttendanceDates':
        requireAuth(e.parameter.token);
        result = getAttendanceDates();
        break;
      case 'getTrashedDates':
        requireAuth(e.parameter.token);
        result = getTrashedDates();
        break;
      case 'getMinutes':
        requireAuth(e.parameter.token);
        result = getMinutesList();
        break;
      case 'getTrashedMinutes':
        requireAuth(e.parameter.token);
        result = getTrashedMinutesList();
        break;
      case 'getCoordinators':
        requireAuth(e.parameter.token);
        result = getCoordinators();
        break;
      case 'getAttendanceStats':
        requireAuth(e.parameter.token);
        result = getAttendanceStats();
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    return jsonOut({ success: true, data: result });
  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    ensureSchema();
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
      case 'login':
        result = login(body.username, body.password);
        break;
      case 'logout':
        requireAuth(body.token);
        result = logout(body.token);
        break;

      case 'addAnnouncement':
        requireAuth(body.token);
        result = addAnnouncement(body);
        break;
      case 'updateAnnouncement':
        requireAuth(body.token);
        result = updateAnnouncement(body);
        break;
      case 'deleteAnnouncement':
        requireAuth(body.token);
        result = deleteRowById(SHEETS.ANNOUNCEMENTS, body.id);
        break;

      case 'addPhoto':
        requireAuth(body.token);
        result = addPhoto(body);
        break;
      case 'deletePhoto':
        requireAuth(body.token);
        result = deleteRowById(SHEETS.PHOTOS, body.id);
        break;

      case 'addMember':
        requireAuth(body.token);
        result = addMember(body);
        break;
      case 'updateMember':
        requireAuth(body.token);
        result = updateMember(body);
        break;
      case 'removeMember':
        requireAuth(body.token);
        result = deleteRowById(SHEETS.MEMBERS, body.id);
        break;

      case 'saveAttendance':
        requireAuth(body.token);
        result = saveAttendance(body);
        break;
      case 'deleteAttendanceForDate':
        requireAuth(body.token);
        result = setAttendanceTrashedStatusForDate(body.date, true);
        break;
      case 'restoreAttendanceForDate':
        requireAuth(body.token);
        result = setAttendanceTrashedStatusForDate(body.date, false);
        break;
      case 'permanentlyDeleteAttendanceForDate':
        requireAuth(body.token);
        result = permanentlyDeleteAttendanceForDate(body.date);
        break;

      case 'addMinutes':
        requireAuth(body.token);
        result = addMinutes(body);
        break;
      case 'updateMinutes':
        requireAuth(body.token);
        result = updateMinutes(body);
        break;
      case 'deleteMinutes':
        requireAuth(body.token);
        updateRowById(SHEETS.MINUTES, body.id, { trashed: true });
        result = { trashed: true };
        break;
      case 'restoreMinutes':
        requireAuth(body.token);
        updateRowById(SHEETS.MINUTES, body.id, { trashed: false });
        result = { restored: true };
        break;
      case 'permanentlyDeleteMinutes':
        requireAuth(body.token);
        result = deleteRowById(SHEETS.MINUTES, body.id);
        break;

      case 'addCoordinator':
        requireAuth(body.token);
        result = addCoordinator(body);
        break;
      case 'removeCoordinator':
        requireAuth(body.token);
        result = removeCoordinator(body);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }
    return jsonOut({ success: true, data: result });
  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

/* ============================== ONE-TIME SETUP ============================== */

/**
 * Run this ONCE from the Apps Script editor (select function `setup`, click Run).
 * Creates all sheets/headers and one starter coordinator account.
 * CHANGE the starter username/password below before running, or change it
 * immediately after logging in for the first time via the site.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    sheet.appendRow(SHEET_HEADERS[name]);
    sheet.setFrozenRows(1);
  });

  // Remove default "Sheet1" if it's empty and unused
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Create a starter coordinator: username "admin", password "changeme123"
  createCoordinatorAccount('admin', 'changeme123', 'Admin Coordinator');

  Logger.log('Setup complete. Login with username "admin" / password "changeme123" — change this immediately.');
}

/* ============================== AUTH ============================== */

function hashPassword(password, salt) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt,
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function createCoordinatorAccount(username, password, name) {
  const salt = Utilities.getUuid();
  const hash = hashPassword(password, salt);
  appendRowObj(SHEETS.COORDINATORS, {
    id: Utilities.getUuid(),
    username: username,
    passwordHash: hash,
    salt: salt,
    name: name,
    createdAt: new Date().toISOString()
  });
}

function login(username, password) {
  if (!username || !password) throw new Error('Username and password required');
  const coords = sheetToObjects(SHEETS.COORDINATORS);
  if (!match) throw new Error('Invalid username or password');
  const hash = hashPassword(password, match.salt);
  if (hash !== match.passwordHash) throw new Error('Invalid username or password');

  const token = Utilities.getUuid();
  const expiresAt = new Date(Date.now() + SESSION_LENGTH_MS).toISOString();
  appendRowObj(SHEETS.SESSIONS, { token: token, username: username, name: match.name, expiresAt: expiresAt });
  return { token: token, name: match.name, username: username };
}

function logout(token) {
  deleteRowByColumn(SHEETS.SESSIONS, 'token', token);
  return { loggedOut: true };
}

function requireAuth(token) {
  if (!token) throw new Error('Not logged in');
  const sessions = sheetToObjects(SHEETS.SESSIONS);
  const session = sessions.find(function (s) { return s.token === token; });
  if (!session) throw new Error('Session not found — please log in again');
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteRowByColumn(SHEETS.SESSIONS, 'token', token);
    throw new Error('Session expired — please log in again');
  }
  return session;
}

/* ============================== ANNOUNCEMENTS ============================== */

function getAnnouncements() {
  return sheetToObjects(SHEETS.ANNOUNCEMENTS).sort(function (a, b) {
    return new Date(b.date) - new Date(a.date);
  });
}

function addAnnouncement(body) {
  const session = requireAuth(body.token);
  const row = {
    id: Utilities.getUuid(),
    date: normalizeDateValue(body.date || new Date()),
    title: body.title,
    content: body.content,
    eventDate: body.eventDate ? normalizeDateValue(body.eventDate) : '',
    postedBy: session.name,
    postedAt: new Date().toISOString()
  };
  appendRowObj(SHEETS.ANNOUNCEMENTS, row);
  return row;
}

function updateAnnouncement(body) {
  requireAuth(body.token);
  updateRowById(SHEETS.ANNOUNCEMENTS, body.id, {
    date: normalizeDateValue(body.date),
    title: body.title,
    content: body.content,
    eventDate: body.eventDate ? normalizeDateValue(body.eventDate) : ''
  });
  return { updated: true };
}

/* ============================== PHOTOS ============================== */
// Photos are stored as Google Drive share links pasted in by coordinators
// (set the Drive file/folder sharing to "Anyone with the link").

function getPhotos() {
  return sheetToObjects(SHEETS.PHOTOS).sort(function (a, b) {
    return new Date(b.date) - new Date(a.date);
  });
}

function addPhoto(body) {
  const session = requireAuth(body.token);
  if (!body.url) {
    throw new Error('No Google Drive link provided.');
  }

  const row = {
    id: Utilities.getUuid(),
    date: normalizeDateValue(body.date || new Date()),
    url: body.url,
    caption: body.caption || '',
    postedBy: session.name,
    postedAt: new Date().toISOString()
  };
  appendRowObj(SHEETS.PHOTOS, row);
  return row;
}

/* ============================== MEMBERS ============================== */

function getMembers() {
  return sheetToObjects(SHEETS.MEMBERS).filter(function (m) { return m.active !== 'FALSE'; });
}

function addMember(body) {
  requireAuth(body.token);
  const row = {
    id: Utilities.getUuid(),
    name: body.name,
    active: 'TRUE',
    addedAt: new Date().toISOString(),
    district: body.district || '',
    age: body.age || '',
    gradeLevel: body.gradeLevel || '',
    school: body.school || '',
    contactNumber: body.contactNumber || ''
  };
  appendRowObj(SHEETS.MEMBERS, row);
  return row;
}

function updateMember(body) {
  requireAuth(body.token);
  updateRowById(SHEETS.MEMBERS, body.id, {
    name: body.name,
    district: body.district,
    age: body.age,
    gradeLevel: body.gradeLevel,
    school: body.school,
    contactNumber: body.contactNumber
  });
  return { updated: true };
}

function normalizeDateValue(value) {
  // Dates should always arrive as plain "YYYY-MM-DD" strings from the
  // frontend. Google Sheets can still auto-convert a date-like string into
  // a real Date value on its own — if that happens, read the date back
  // using its own local getters (no explicit timezone conversion, so no
  // UTC day-shift) rather than a fixed calendar string.
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value || '').slice(0, 10);
}

/* ============================== ATTENDANCE ============================== */

function getAttendanceDates() {
  const rows = sheetToObjects(SHEETS.ATTENDANCE);
  const dates = new Set();
  rows.forEach(function (r) {
    if (r.trashed !== true && r.trashed !== 'TRUE' && r.date) {
      dates.add(normalizeDateValue(r.date));
    }
  });
  return Array.from(dates).sort().reverse();
}

function getTrashedDates() {
  const rows = sheetToObjects(SHEETS.ATTENDANCE);
  const dates = new Set();
  rows.forEach(function (r) {
    if ((r.trashed === true || r.trashed === 'TRUE') && r.date) {
      dates.add(normalizeDateValue(r.date));
    }
  });
  return Array.from(dates).sort().reverse();
}

function getAttendanceForDate(date) {
  const targetDate = normalizeDateValue(date);
  return sheetToObjects(SHEETS.ATTENDANCE).filter(function (r) {
    return normalizeDateValue(r.date) === targetDate && r.trashed !== true && r.trashed !== 'TRUE';
  });
}

function saveAttendance(body) {
  // body: { token, date, records: [{ memberId, memberName, present }] }
  const session = requireAuth(body.token);
  const targetDate = normalizeDateValue(body.date);
  const existingForDate = getAttendanceForDate(targetDate);
  const now = new Date().toISOString();

  body.records.forEach(function (rec) {
    const found = existingForDate.find(function (r) { return r.memberId === rec.memberId; });
    if (found) {
      updateRowById(SHEETS.ATTENDANCE, found.id, { present: rec.present, recordedBy: session.name, recordedAt: now, trashed: false });
    } else {
      appendRowObj(SHEETS.ATTENDANCE, {
        id: Utilities.getUuid(),
        date: targetDate,
        memberId: rec.memberId,
        memberName: rec.memberName,
        present: rec.present,
        recordedBy: session.name,
        recordedAt: now,
        trashed: false
      });
    }
  });
  return { saved: true, count: body.records.length };
}

function setAttendanceTrashedStatusForDate(date, isTrashed) {
  const sheet = getSheet(SHEETS.ATTENDANCE);
  const headers = getActualHeaders(SHEETS.ATTENDANCE);
  const trashedColIndex = headers.indexOf('trashed') + 1;
  const dateColIndex = headers.indexOf('date') + 1;

  const data = sheet.getDataRange().getValues();
  const targetDate = normalizeDateValue(date);

  for (let i = 1; i < data.length; i++) {
    const recordDate = normalizeDateValue(data[i][dateColIndex - 1]);
    if (recordDate === targetDate) {
      sheet.getRange(i + 1, trashedColIndex).setValue(isTrashed);
    }
  }
  return { success: true, date: targetDate, trashed: isTrashed };
}

function permanentlyDeleteAttendanceForDate(date) {
  const sheet = getSheet(SHEETS.ATTENDANCE);
  const dateColIndex = getActualHeaders(SHEETS.ATTENDANCE).indexOf('date') + 1;
  const data = sheet.getDataRange().getValues();
  const targetDate = normalizeDateValue(date);
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const recordDate = normalizeDateValue(data[i][dateColIndex - 1]);
    if (recordDate === targetDate) rowsToDelete.push(i + 1);
  }
  for (let i = rowsToDelete.length - 1; i >= 0; i--) sheet.deleteRow(rowsToDelete[i]);
  return { success: true, date: targetDate, purged: true };
}

/* ============================== MINUTES ============================== */

function getMinutesList() {
  return sheetToObjects(SHEETS.MINUTES)
    .filter(function (m) { return m.trashed !== true && m.trashed !== 'TRUE'; })
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
}

function getTrashedMinutesList() {
  return sheetToObjects(SHEETS.MINUTES)
    .filter(function (m) { return m.trashed === true || m.trashed === 'TRUE'; })
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
}

function addMinutes(body) {
  const session = requireAuth(body.token);
  const row = {
    id: Utilities.getUuid(),
    date: normalizeDateValue(body.date || new Date()),
    title: "'" + String(body.title || ''),
    content: body.content,
    recordedBy: session.name,
    recordedAt: new Date().toISOString(),
    trashed: false
  };
  appendRowObj(SHEETS.MINUTES, row);
  return row;
}

function updateMinutes(body) {
  requireAuth(body.token);
  updateRowById(SHEETS.MINUTES, body.id, {
    date: normalizeDateValue(body.date),
    title: "'" + String(body.title || ''),
    content: body.content
  });
  return { updated: true };
}

/* ============================== COORDINATORS ============================== */

function getCoordinators() {
  return sheetToObjects(SHEETS.COORDINATORS).map(function (c) {
    return { id: c.id, username: c.username, name: c.name, createdAt: c.createdAt };
  });
}

function addCoordinator(body) {
  requireAuth(body.token);
  const existing = sheetToObjects(SHEETS.COORDINATORS);
  if (existing.some(function (c) { return c.username === body.username; })) {
    throw new Error('That username is already taken');
  }
  createCoordinatorAccount(body.username, body.password, body.name);
  return { created: true };
}

function removeCoordinator(body) {
  requireAuth(body.token);
  const all = sheetToObjects(SHEETS.COORDINATORS);
  if (all.length <= 1) throw new Error('Cannot remove the last coordinator account');
  deleteRowById(SHEETS.COORDINATORS, body.id);
  return { removed: true };
}

/* ============================== STATISTICS ============================== */

function getAttendanceStats() {
  const members = sheetToObjects(SHEETS.MEMBERS);
  const memberDistrictMap = members.reduce(function (map, m) {
    map[m.id] = m.district;
    return map;
  }, {});

  const attendance = sheetToObjects(SHEETS.ATTENDANCE);
  const stats = {}; // { "YYYY-MM": { "D1": count, "D2": count, ... } }

  attendance.forEach(function (rec) {
    if (rec.trashed === true || rec.trashed === 'TRUE') return;
    if (rec.present !== true && rec.present !== 'TRUE') return;

    const district = memberDistrictMap[rec.memberId];
    if (!district) return;

    const month = normalizeDateValue(rec.date).slice(0, 7); // "YYYY-MM"

    if (!stats[month]) {
      stats[month] = {};
    }
    if (!stats[month][district]) {
      stats[month][district] = 0;
    }
    stats[month][district]++;
  });

  return stats;
}

/* ============================== SHEET HELPERS ============================== */

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name + ' — did you run setup()?');
  return sheet;
}

// Reads the sheet's ACTUAL header row (row 1) — this is the source of truth
// for column order and names, not the hardcoded SHEET_HEADERS list. That way
// the code always matches whatever is really in the spreadsheet, even if a
// column was added or reordered by hand.
function getActualHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
}

// Runs once per request: makes sure every sheet has every column that
// SHEET_HEADERS expects it to have (like 'trashed'). If one is missing —
// because it was never added, or added with a typo — it's appended as a
// new column automatically. This means soft-delete / trash features can
// never silently fail just because a header wasn't set up by hand.
function ensureSchema() {
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) return; // setup() hasn't been run yet — nothing to heal
    const existing = getActualHeaders(name);
    SHEET_HEADERS[name].forEach(function (col) {
      if (existing.indexOf(col) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
        existing.push(col);
      }
    });
  });
}

function sheetToObjects(name) {
  const sheet = getSheet(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h || '').trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (cell) { return cell !== ''; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) {
        if (!h) return;
        // Any column literally named 'date' is always normalized to a plain
        // "YYYY-MM-DD" string here — this is the one place it happens, so no
        // individual feature (Attendance, Minutes, Announcements, Photos...)
        // can forget to do it and leak a raw Date/timestamp to the frontend.
        obj[h] = (h === 'date') ? normalizeDateValue(row[i]) : row[i];
      });
      return obj;
    });
}

function appendRowObj(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = getActualHeaders(sheetName);
  const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
}

function findRowIndexById(sheetName, id) {
  const sheet = getSheet(sheetName);
  const headers = getActualHeaders(sheetName);
  const idCol = headers.indexOf('id');
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][idCol] === id) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function updateRowById(sheetName, id, updates) {
  const sheet = getSheet(sheetName);
  const headers = getActualHeaders(sheetName);
  const rowIndex = findRowIndexById(sheetName, id);
  if (rowIndex === -1) throw new Error('Record not found: ' + id);
  Object.keys(updates).forEach(function (key) {
    const col = headers.indexOf(key);
    if (col !== -1) sheet.getRange(rowIndex, col + 1).setValue(updates[key]);
  });
}

function deleteRowById(sheetName, id) {
  const rowIndex = findRowIndexById(sheetName, id);
  if (rowIndex === -1) throw new Error('Record not found: ' + id);
  getSheet(sheetName).deleteRow(rowIndex); // No recordChange() here, as it's called by the specific delete functions
  return { deleted: true };
}

function deleteRowByColumn(sheetName, columnName, value) {
  const sheet = getSheet(sheetName);
  const headers = getActualHeaders(sheetName);
  const col = headers.indexOf(columnName);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][col] === value) sheet.deleteRow(i + 1);
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}