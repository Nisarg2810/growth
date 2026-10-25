// Growth — Google Sheets backend: your login + database.
// Setup: paste this into your Google Sheet ▸ Extensions ▸ Apps Script (replace everything),
// set PASSWORD below, Save, then Deploy ▸ New deployment ▸ Web app
// (Execute as: Me · Who has access: Anyone). Without the password it refuses to read or write anything.
// Updating later: paste the new code, keep your PASSWORD line, Save, then Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.
const PASSWORD = 'CHANGE-ME';
const CHUNK = 40000; // Sheets cells hold max 50k characters

function doGet() {
  return ContentService.createTextOutput('Growth backend is running ✓');
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (PASSWORD === 'CHANGE-ME' || body.token !== PASSWORD) return json_({ ok: false, error: 'Wrong password' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'get') return json_(read_());
    if (body.action === 'put') return json_(write_(body));
    if (body.action === 'saveMeal') return json_(saveMeal_(body.row));
    if (body.action === 'deleteMeal') return json_(deleteMeal_(body.id));
    return json_({ ok: false, error: 'Unknown action' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- app data (profile, plans, ticks, weigh-ins) ---------- */
function read_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('_backup');
  let data = null;
  // each chunk is stored with a leading "x" so Sheets never turns it into a number, date or formula
  if (sh && sh.getLastRow() > 0) data = JSON.parse(sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(function (r) { return String(r[0]).slice(1); }).join(''));
  const updatedAt = Number(PropertiesService.getScriptProperties().getProperty('updatedAt') || 0);
  return { ok: true, version: 2, data: data, updatedAt: updatedAt, mealRows: readMeals_() };
}

function write_(body) {
  const ss = SpreadsheetApp.getActive();
  const raw = JSON.stringify(body.data);
  const chunks = [];
  for (let i = 0; i < raw.length; i += CHUNK) chunks.push(['x' + raw.slice(i, i + CHUNK)]);
  const sh = sheet_(ss, '_backup');
  sh.clearContents();
  sh.getRange(1, 1, chunks.length, 1).setValues(chunks);
  sh.hideSheet();
  // readable tabs (Daily, Meal log, Weight) — the Meals tab is never overwritten here
  Object.keys(body.sheets || {}).forEach(function (name) { if (name !== 'Meals') table_(sheet_(ss, name), body.sheets[name]); });
  PropertiesService.getScriptProperties().setProperty('updatedAt', String(body.updatedAt));
  return { ok: true, updatedAt: body.updatedAt };
}

function table_(sh, rows) {
  sh.clearContents();
  if (!rows || !rows.length) return;
  const head = Object.keys(rows[0]);
  const values = [head].concat(rows.map(function (r) {
    return head.map(function (h) {
      const v = r[h] === undefined || r[h] === null ? '' : r[h];
      return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; // keep text that looks like a formula as text
    });
  }));
  sh.getRange(1, 1, values.length, head.length).setValues(values);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
}

/* ---------- Meals tab: one row per meal or workout, editable by hand ---------- */
// Columns are matched by their header name, so new columns can be added without changing this script.
function mealsSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Meals');
  if (!sh) {
    sh = ss.insertSheet('Meals', 0);
    sh.getRange(1, 1, 1, 2).setValues([['id', 'Meal']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function head_(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
}

// rows as { header: displayed text } — displayed text keeps "07:00" and dates exactly as you see them
function readMeals_() {
  const sh = mealsSheet_(), head = head_(sh), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const idCol = head.indexOf('id');
  const values = sh.getRange(2, 1, n, head.length).getDisplayValues();
  const out = [];
  values.forEach(function (r, i) {
    if (!r.some(function (v) { return String(v).trim(); })) return;
    if (idCol >= 0 && !String(r[idCol]).trim()) { // rows typed in by hand get an id
      r[idCol] = 'm' + Utilities.getUuid().slice(0, 8);
      sh.getRange(i + 2, idCol + 1).setValue(r[idCol]);
    }
    const row = {};
    head.forEach(function (h, c) { if (h) row[h] = r[c]; });
    out.push(row);
  });
  return out;
}

function saveMeal_(row) {
  const sh = mealsSheet_();
  let head = head_(sh);
  // add any column the app sends that the sheet doesn't have yet
  Object.keys(row).forEach(function (h) {
    if (head.indexOf(h) < 0) {
      const col = head.filter(String).length + 1;
      sh.getRange(1, col).setValue(h).setFontWeight('bold');
      head = head_(sh);
    }
  });
  const values = head.map(function (h) { return row[h] === undefined ? '' : row[h]; });
  ['id', 'Every day at', 'Days', 'From'].forEach(function (h) { // plain text: keeps 07:00 and dates exactly as typed
    const c = head.indexOf(h) + 1;
    if (c) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  const r = findRow_(sh, head, row.id);
  if (r > 0) sh.getRange(r, 1, 1, head.length).setValues([values]);
  else sh.appendRow(values);
  return { ok: true };
}

function deleteMeal_(id) {
  const sh = mealsSheet_(), r = findRow_(sh, head_(sh), id);
  if (r > 0) sh.deleteRow(r);
  return { ok: true };
}

function findRow_(sh, head, id) {
  const col = head.indexOf('id') + 1, n = sh.getLastRow() - 1;
  if (!col || n < 1) return -1;
  const ids = sh.getRange(2, col, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
