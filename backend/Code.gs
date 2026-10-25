// Growth — Google Sheets backend: your login + database.
// Setup: paste this into your Google Sheet ▸ Extensions ▸ Apps Script (replace everything),
// set PASSWORD below, Save, then Deploy ▸ New deployment ▸ Web app
// (Execute as: Me · Who has access: Anyone). Without the password it refuses to read or write anything.
const PASSWORD = 'CHANGE-ME';
const CHUNK = 40000; // Sheets cells hold max 50k characters
const MEAL_HEAD = ['id', 'Meal', 'Details', 'kcal', 'Protein g', 'Carbs g', 'Fat g', 'Every day at', 'From', 'Ingredients (one per line: name | qty | kcal | P | C | F)'];

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
    if (body.action === 'saveMeal') return json_(saveMeal_(body.meal));
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
  return { ok: true, data: data, updatedAt: updatedAt, meals: readMeals_() };
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

/* ---------- Meals tab: one row per meal, editable by hand ---------- */
function mealsSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Meals');
  if (!sh) {
    sh = ss.insertSheet('Meals', 0);
    sh.getRange(1, 1, 1, MEAL_HEAD.length).setValues([MEAL_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('H:I').setNumberFormat('@'); // keep "07:00, 17:00" and dates as plain text
    sh.getRange('J:J').setWrap(true);
  }
  return sh;
}

function text_(v, kind) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), kind === 'time' ? 'HH:mm' : 'yyyy-MM-dd');
  return String(v === undefined || v === null ? '' : v);
}

function readMeals_() {
  const sh = mealsSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const rows = sh.getRange(2, 1, n, MEAL_HEAD.length).getValues();
  const out = [];
  rows.forEach(function (r, i) {
    if (!String(r[1]).trim()) return;
    let id = String(r[0]).trim();
    if (!id) { id = 'm' + Utilities.getUuid().slice(0, 8); sh.getRange(i + 2, 1).setValue(id); } // rows typed in by hand get an id
    out.push({
      id: id, title: String(r[1]).trim(), details: text_(r[2]),
      kcal: +r[3] || 0, p: +r[4] || 0, c: +r[5] || 0, f: +r[6] || 0,
      daily: text_(r[7], 'time').split(/[,\s]+/).filter(function (t) { return /^\d{1,2}:\d{2}$/.test(t); }).map(function (t) { return ('0' + t).slice(-5); }),
      from: text_(r[8], 'date'),
      ingredients: text_(r[9]).split('\n').map(function (l) { return l.split('|').map(function (x) { return x.trim(); }); })
        .filter(function (x) { return x[0]; })
        .map(function (x) { return { name: x[0], qty: x[1] || '', kcal: +x[2] || 0, p: +x[3] || 0, c: +x[4] || 0, f: +x[5] || 0 }; }),
    });
  });
  return out;
}

function mealRow_(m) {
  return [m.id, m.title, m.details || '', +m.kcal || 0, +m.p || 0, +m.c || 0, +m.f || 0, (m.daily || []).join(', '), m.from || '',
    (m.ingredients || []).map(function (x) { return [x.name, x.qty, x.kcal, x.p, x.c, x.f].join(' | '); }).join('\n')];
}

function findRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

function saveMeal_(m) {
  const sh = mealsSheet_(), row = findRow_(sh, m.id);
  if (row > 0) sh.getRange(row, 1, 1, MEAL_HEAD.length).setValues([mealRow_(m)]);
  else sh.appendRow(mealRow_(m));
  return { ok: true };
}

function deleteMeal_(id) {
  const sh = mealsSheet_(), row = findRow_(sh, id);
  if (row > 0) sh.deleteRow(row);
  return { ok: true };
}

function sheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
