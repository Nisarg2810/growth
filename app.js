'use strict';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => ymd(new Date());
const monday = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // plan days, Mon = 0
const DAY_ONE = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const short = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
// times are stored as 24-hour "HH:MM" (sorts correctly) and shown as 12-hour "7:30 PM"
const t12 = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
function parseTimes(str) {
  const out = [];
  String(str || '').replace(/(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap])\.?\s*m\b\.?|(\d{1,2}):(\d{2})/gi, (_, h1, m1, ap, h2, m2) => {
    let h = +(h1 ?? h2);
    const m = +(m1 ?? m2 ?? 0);
    if (ap) h = (h % 12) + (/p/i.test(ap) ? 12 : 0);
    if (h < 24 && m < 60) out.push(`${pad(h)}:${pad(m)}`);
  });
  return out;
}
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save on this device'); } };
const svg = (p, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  left: svg('<path d="m15 18-6-6 6-6"/>'), right: svg('<path d="m9 18 6-6-6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'), x: svg('<path d="M18 6 6 18M6 6l12 12"/>'), check: svg('<path d="M20 6 9 17l-5-5"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', 16),
  repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', 13),
  today: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>', 22),
  plan: svg('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', 22),
  meals: svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>', 22),
  progress: svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>', 22),
  run: svg('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', 14),
  flame: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', 14),
};

/* ---------- state ---------- */
const APP = window.APP || { name: 'You', backend: '' };
const KEY = 'growth-v2', AUTH_KEY = KEY + '-auth', MEALS_KEY = KEY + '-meals';
// no personal data in code: the profile is entered once in the app and lives in your Google Sheet
const DEFAULT = {
  days: {}, menus: {}, weights: {}, meals: [],
  settings: {
    profile: { dob: '', sex: 'male', heightCm: '', activity: 'light', goal: 'lose05', proteinPerKg: 1.8 },
    kcalOverride: '', proteinOverride: '', planHit: 80,
  },
  lastExport: null,
};
function merge(base, x) {
  for (const k in x) {
    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    if (isObj(x[k]) && isObj(base[k])) merge(base[k], x[k]); else base[k] = x[k];
  }
  return base;
}
let S = merge(structuredClone(DEFAULT), read(KEY) || {});
let AUTH = read(AUTH_KEY) || {};             // { token } when signed in, { local: true } for this-device-only
let CLOUD_MEALS = read(MEALS_KEY) || [];     // meals from the Sheet's Meals tab (cached for instant load)
const signedIn = () => !!(AUTH.token && APP.backend);
const localMode = () => !AUTH.token && !!AUTH.local;
const st = () => S.settings;
function save() {
  S.updatedAt = Date.now();
  write(KEY, S);
  schedulePush();
}

/* ---------- Google Sheet backend ---------- */
let syncState = 'off', syncErr = '', pushTimer = null, lastSync = 0;
function setSync(s, err = '') {
  syncState = s; syncErr = err;
  const dot = $('.avatar'); if (dot) dot.dataset.sync = s;
  const el = $('#syncStatus'); if (el) el.textContent = syncText();
}
const syncText = () => ({
  off: 'Saved on this device only', pending: 'Saving…', syncing: 'Syncing…',
  ok: `Synced to your Google Sheet${lastSync ? ' · ' + new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
  error: `Couldn’t reach your Sheet (${syncErr}) — changes are kept here and retried.`,
}[syncState]);
async function cloud(action, extra = {}, token = AUTH.token) {
  // text/plain avoids a CORS preflight, which Apps Script can't answer
  const r = await fetch(APP.backend, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, action, ...extra }) });
  let j;
  try { j = await r.json(); } catch (e) { throw new Error('backend didn’t answer'); }
  if (!j.ok) throw new Error(j.error || 'Unknown error');
  return j;
}
function applyCloud(j) {
  CLOUD_MEALS = j.mealRows ? j.mealRows.map(fromRow).filter(m => m.title) : j.meals || [];
  write(MEALS_KEY, CLOUD_MEALS);
  const local = S.updatedAt || 0;
  if (j.data && j.updatedAt > local) { S = merge(structuredClone(DEFAULT), j.data); write(KEY, S); }
  else if (local > (j.updatedAt || 0)) schedulePush(0);
}
async function pull() {
  if (!signedIn() || pushTimer) return;
  setSync('syncing');
  try {
    applyCloud(await cloud('get'));
    lastSync = Date.now(); setSync('ok');
    if (!$('#sheet.open')) render();
  } catch (e) {
    if (e.message === 'Wrong password') return signOut(true);
    setSync('error', e.message);
  }
}
async function push() {
  clearTimeout(pushTimer); pushTimer = null;
  if (!signedIn()) return;
  setSync('syncing');
  try {
    await cloud('put', { data: S, updatedAt: S.updatedAt || Date.now(), sheets: buildSheets() });
    lastSync = Date.now(); setSync('ok');
  } catch (e) { setSync('error', e.message); }
}
function schedulePush(delay = 2500) {
  if (!signedIn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, delay);
  setSync('pending');
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
addEventListener('pagehide', () => {
  if (!pushTimer || !signedIn()) return;
  navigator.sendBeacon(APP.backend, new Blob([JSON.stringify({ token: AUTH.token, action: 'put', data: S, updatedAt: S.updatedAt, sheets: buildSheets() })], { type: 'text/plain' }));
});
async function signIn(pw) {
  UI.loginBusy = true; UI.loginErr = ''; render();
  try {
    const j = await cloud('get', {}, pw);
    AUTH = { token: pw }; write(AUTH_KEY, AUTH);
    const localMeals = S.meals;
    applyCloud(j);
    // first sign-in after using the app on this device: move local meals into the Sheet
    if (!CLOUD_MEALS.length && localMeals.length) for (const m of localMeals) await persistMeal(m, true);
    lastSync = Date.now(); syncState = 'ok';
  } catch (e) {
    UI.loginErr = e.message === 'Wrong password' ? 'That password isn’t right.' : `Couldn’t reach your Sheet — ${e.message}.`;
  }
  UI.loginBusy = false; render();
}
async function signOut(expired) {
  if (!expired && !confirm('Sign out on this device? Your data stays safe in your Google Sheet.')) return;
  if (pushTimer) await push();
  AUTH = {}; CLOUD_MEALS = []; S = structuredClone(DEFAULT);
  [AUTH_KEY, MEALS_KEY, KEY].forEach(k => localStorage.removeItem(k));
  UI.loginErr = expired ? 'Your password changed — sign in again.' : '';
  UI.tab = 'today'; render();
}

/* ---------- meal library ---------- */
// The Sheet's Meals tab: one row per meal or workout, columns matched by header name
const COLS = {
  id: 'id', title: 'Meal', kind: 'Type', details: 'Details', kcal: 'kcal', p: 'Protein g', c: 'Carbs g', f: 'Fat g', fb: 'Fiber g',
  daily: 'Every day at', days: 'Days', from: 'From', ingredients: 'Ingredients (one per line: name | qty | kcal | P | C | F)',
};
const DAY3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// "Mon-Sat", "Mon, Wed, Fri", "Weekdays" → [0..6] (Mon = 0); blank / "Every day" → [] meaning all days
function parseDays(str) {
  const t = String(str || '').toLowerCase().trim(), ix = w => DAY3.findIndex(d => w.trim().startsWith(d.toLowerCase()));
  if (!t || /every|daily|all/.test(t)) return [];
  if (/weekday/.test(t)) return [0, 1, 2, 3, 4];
  if (/weekend/.test(t)) return [5, 6];
  const out = new Set();
  t.split(/[,/&]| and /).forEach(part => {
    const [a, b] = part.split(/\s*(?:-|–|to)\s*/).map(ix);
    if (a < 0) return;
    if (b === undefined || b < 0) out.add(a); else for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  });
  return [...out].sort();
}
function daysText(days) {
  if (!days?.length || days.length === 7) return '';
  const contiguous = days.every((d, i) => !i || d === days[i - 1] + 1);
  return contiguous && days.length > 2 ? `${DAY3[days[0]]}-${DAY3[days.at(-1)]}` : days.map(d => DAY3[d]).join(', ');
}
function fromRow(r) {
  const keys = Object.keys(r);
  const get = h => { const k = keys.find(x => x === h) ?? keys.find(x => x.toLowerCase().startsWith(h.split(' (')[0].toLowerCase())); return k ? String(r[k] ?? '').trim() : ''; };
  return {
    id: get(COLS.id), title: get(COLS.title), kind: /work|exercise|run|gym|walk|yoga/i.test(get(COLS.kind)) ? 'workout' : 'food',
    details: get(COLS.details), kcal: +get(COLS.kcal) || 0, p: +get(COLS.p) || 0, c: +get(COLS.c) || 0, f: +get(COLS.f) || 0, fb: +get(COLS.fb) || 0,
    daily: parseTimes(get(COLS.daily)), days: parseDays(get(COLS.days)), from: get(COLS.from),
    ingredients: get(COLS.ingredients).split('\n').map(l => l.split('|').map(x => x.trim())).filter(x => x[0])
      .map(x => ({ name: x[0], qty: x[1] || '', kcal: +x[2] || 0, p: +x[3] || 0, c: +x[4] || 0, f: +x[5] || 0 })),
  };
}
const toRow = m => ({
  [COLS.id]: m.id, [COLS.title]: m.title, [COLS.kind]: m.kind === 'workout' ? 'Workout' : 'Meal', [COLS.details]: m.details || '',
  [COLS.kcal]: +m.kcal || 0, [COLS.p]: +m.p || 0, [COLS.c]: +m.c || 0, [COLS.f]: +m.f || 0, [COLS.fb]: +m.fb || 0,
  [COLS.daily]: (m.daily || []).join(', '), [COLS.days]: daysText(m.days), [COLS.from]: m.from || '',
  [COLS.ingredients]: (m.ingredients || []).map(x => [x.name, x.qty, x.kcal, x.p, x.c, x.f].join(' | ')).join('\n'),
});
// workouts burn calories, they're never counted as eaten. Ids starting "run-", "workout-" or "w-" are workouts even when
// an older backend script doesn't send the Type column.
const isWorkout = m => m?.kind === 'workout' || /^(run-|workout-|w-|w[a-z0-9]{7}$)/i.test(m?.id || '');
// signed in: the Meals tab of your Sheet; this-device mode: stored locally
const lib = () => (signedIn() ? CLOUD_MEALS : S.meals);
const mealById = id => lib().find(m => m.id === id);
const libSorted = () => lib().filter(m => m.title?.trim()).sort((a, b) => a.title.localeCompare(b.title));
async function persistMeal(m, quiet) {
  if (!signedIn()) {
    const i = S.meals.findIndex(x => x.id === m.id);
    if (i >= 0) S.meals[i] = m; else S.meals.push(m);
    save(); if (!quiet) render();
    return;
  }
  const i = CLOUD_MEALS.findIndex(x => x.id === m.id);
  if (i >= 0) CLOUD_MEALS[i] = m; else CLOUD_MEALS.push(m);
  write(MEALS_KEY, CLOUD_MEALS);
  if (!quiet) render();
  setSync('syncing');
  try { await cloud('saveMeal', { meal: m, row: toRow(m) }); lastSync = Date.now(); setSync('ok'); } catch (e) { setSync('error', e.message); toast('Couldn’t save the meal to your Sheet'); }
}
async function removeMeal(id) {
  if (!signedIn()) { S.meals = S.meals.filter(m => m.id !== id); save(); render(); return; }
  CLOUD_MEALS = CLOUD_MEALS.filter(m => m.id !== id); write(MEALS_KEY, CLOUD_MEALS); render();
  try { await cloud('deleteMeal', { id }); setSync('ok'); } catch (e) { setSync('error', e.message); }
}

/* ---------- nutrition ---------- */
const ZERO = { kcal: 0, p: 0, c: 0, f: 0, fb: 0 };
const addN = (a, m) => ({ kcal: a.kcal + (+m.kcal || 0), p: a.p + (+m.p || 0), c: a.c + (+m.c || 0), f: a.f + (+m.f || 0), fb: a.fb + (+m.fb || 0) });
const sumN = list => list.reduce(addN, { ...ZERO });
const kc = n => Math.round(n).toLocaleString('en-IN');
const g = n => Math.round(n);

/* ---------- weekly plan ---------- */
// S.menus[mondayKey].slots = [{ id, day (Mon = 0), time, mealId, snap }]; ticks live in S.days[k].ate[slotId]
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const weekOf = k => ymd(monday(parse(k)));
const dowIdx = k => (parse(k).getDay() + 6) % 7;
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99');
const planHit = () => (+st().planHit || 80) / 100;
const pctText = p => (p == null ? '–' : Math.round(p * 100) + '%');
const menu = ws => (S.menus[ws] ??= { slots: [] });
const slotsOf = ws => S.menus[ws]?.slots || [];
const weekKeys = ws => [...Array(7)].map((_, i) => ymd(addDays(parse(ws), i)));
// meals with "Every day at" times are added to each day automatically from their start date
const dailyOn = k => lib().filter(m => m.daily?.length && (!m.from || m.from <= k) && (!m.days?.length || m.days.includes(dowIdx(k))))
  .flatMap(m => m.daily.map(t => ({ id: `d-${m.id}-${t.replace(':', '')}`, day: dowIdx(k), time: t, mealId: m.id, daily: true })));
const slotsOn = k => [...dailyOn(k), ...slotsOf(weekOf(k)).filter(s => s.day === dowIdx(k))].sort(byTime);
const planned = ws => slotsOf(ws).length;
function day(k) {
  const d = (S.days[k] ??= {});
  d.ate ??= {}; d.extra ??= [];
  return d;
}
const ate = (k, s) => !!S.days[k]?.ate?.[s.id];
const isW = s => isWorkout(slotMeal(s));
// live values from the library; a snapshot keeps history right if a meal is later deleted
function slotMeal(s) {
  const m = mealById(s.mealId);
  if (m && !s.daily) s.snap = { title: m.title, kind: m.kind, kcal: +m.kcal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0, fb: +m.fb || 0 };
  return m || s.snap || { title: '(deleted meal)', ...ZERO };
}
// past days count fully; today only meals already ticked or whose time has passed. null = nothing planned
function adherence(k, soFar = true, workouts = false) {
  if (k > today()) return null;
  const all = slotsOn(k).filter(s => isW(s) === workouts);
  if (!all.length) return null;
  const items = soFar && k === today() ? all.filter(s => ate(k, s) || (s.time && s.time <= nowHM())) : all;
  if (!items.length) return null;
  const done = items.filter(s => ate(k, s)).length;
  return { done, n: items.length, pct: done / items.length };
}
function totals(k) {
  const all = slotsOn(k).filter(s => !isW(s)), extra = S.days[k]?.extra || []; // workouts burn, they aren't eaten
  return {
    planned: sumN(all.map(slotMeal)),
    eaten: sumN([...all.filter(s => ate(k, s)).map(slotMeal), ...extra]),
    extra: sumN(extra),
  };
}
const onPlan = k => { const a = adherence(k); return !!a && a.pct >= planHit(); };
function planSum(keys, workouts = false) {
  let done = 0, n = 0, days = 0, hit = 0;
  keys.forEach(k => {
    const a = adherence(k, true, workouts);
    if (!a) return;
    done += a.done; n += a.n; days++;
    if (a.pct >= planHit()) hit++;
  });
  return { done, n, days, hit, pct: n ? done / n : null };
}
function planStreak() {
  let d = new Date(), n = 0;
  if (!onPlan(ymd(d))) d = addDays(d, -1);
  while (onPlan(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
// consecutive scheduled workouts done; rest days don't break it, and today counts only once done
function workoutStreak() {
  let n = 0;
  for (let i = 0, d = new Date(); i < 400; i++, d = addDays(d, -1)) {
    const a = adherence(ymd(d), false, true);
    if (!a) continue;
    if (a.done === a.n) n++; else if (ymd(d) !== today()) break;
  }
  return n;
}
function bestStreak() {
  const first = [...Object.keys(S.menus).filter(planned), ...lib().filter(m => m.daily?.length).map(m => m.from || today())].sort()[0];
  if (!first) return 0;
  let best = 0, run = 0;
  for (let d = parse(first); ymd(d) <= today(); d = addDays(d, 1)) {
    run = onPlan(ymd(d)) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/* ---------- weight & targets ---------- */
const weights = () => Object.entries(S.weights).filter(([, v]) => +v > 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ k, kg: +v }));
const weightOn = k => weights().filter(x => x.k <= k).at(-1)?.kg || weights()[0]?.kg || null;
const kgDiff = n => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(1)} kg`;
// Mifflin-St Jeor BMR × activity = maintenance; the goal adjusts it by 7,700 kcal per kg. Recalculates from each weigh-in.
const ACTIVITY = {
  sedentary: [1.2, 'Sedentary — desk job, little exercise'],
  light: [1.375, 'Light — workouts 1–3 days a week'],
  moderate: [1.55, 'Moderate — workouts 3–5 days a week'],
  very: [1.725, 'Very active — hard workouts 6–7 days'],
};
const GOALS = {
  lose075: [-0.75, 'Lose 0.75 kg a week'], lose05: [-0.5, 'Lose 0.5 kg a week'], lose025: [-0.25, 'Lose 0.25 kg a week'],
  maintain: [0, 'Maintain weight'], gain025: [0.25, 'Gain 0.25 kg a week'],
};
function ageOn(k) {
  const b = parse(st().profile.dob), d = parse(k);
  return d.getFullYear() - b.getFullYear() - (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate()) ? 1 : 0);
}
const profileReady = () => !!(st().profile.dob && +st().profile.heightCm && weights().length);
function target(k = today()) {
  const P = st().profile, kg = weightOn(k), h = +P.heightCm;
  if (!kg || !h || !P.dob) return { ok: false, kcal: +st().kcalOverride || 2000, protein: +st().proteinOverride || 120 };
  const age = ageOn(k), bmr = 10 * kg + 6.25 * h - 5 * age + (P.sex === 'female' ? -161 : 5);
  const tdee = bmr * (ACTIVITY[P.activity] || ACTIVITY.light)[0], goal = tdee + ((GOALS[P.goal] || GOALS.maintain)[0] * 7700) / 7;
  const r10 = n => Math.round(n / 10) * 10, auto = r10(Math.max(goal, bmr)); // never plan below BMR
  return {
    ok: true, kg, age, bmi: kg / (h / 100) ** 2, bmr: r10(bmr), tdee: r10(tdee), floored: goal < bmr,
    kcal: +st().kcalOverride || auto, protein: +st().proteinOverride || Math.round(kg * (+P.proteinPerKg || 1.6)),
  };
}

/* ---------- form bindings ---------- */
function getPath(p) { return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S); }
function setPath(p, v) {
  const ks = p.split('.');
  let o = S;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] ??= (/^\d+$/.test(ks[i + 1]) ? [] : {});
  o[ks.at(-1)] = v;
}
const num = (p, a = '') => `<input type="number" inputmode="decimal" data-p="${p}" value="${esc(getPath(p))}" ${a}>`;

document.addEventListener('input', e => {
  const el = e.target, p = el.dataset.p;
  if (el.dataset.q !== undefined) { $('#qlist').innerHTML = LISTS[el.dataset.q](el.value); return; }
  if (!p) return;
  const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value;
  setPath(p, v); save();
  if (el.type === 'checkbox') render(); else refreshLive(); // ticks update group counts; typing keeps focus
});
document.addEventListener('change', e => {
  if (e.target.id === 'importFile' && e.target.files[0]) importXlsx(e.target.files[0]);
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) { e.preventDefault(); ACTIONS[b.dataset.act]?.(b.dataset.v, b); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target.dataset.form;
  if (f === 'login') signIn($('#pw').value);
  if (f === 'meal') ACTIONS.saveMealForm();
  if (f === 'profile') ACTIONS.saveProfile();
  if (f === 'quick') ACTIONS.addQuick();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- bottom sheet ---------- */
let sheetRaf;
function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sh-bg" data-act="closeSheet"></div><div class="sh" role="dialog" aria-modal="true"><div class="grip"></div>${html}</div>`;
  sheetRaf = requestAnimationFrame(() => s.classList.add('open'));
  document.body.classList.add('noscroll');
  setTimeout(() => s.querySelector('[data-focus]')?.focus(), 250);
}
function closeSheet() {
  const s = $('#sheet');
  cancelAnimationFrame(sheetRaf);
  if (!s.innerHTML) return;
  s.classList.remove('open'); document.body.classList.remove('noscroll');
  setTimeout(() => { if (!s.classList.contains('open')) s.innerHTML = ''; }, 250);
}
const sheetHead = (title, sub = '') => `<div class="sh-head"><div><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
  <button class="icon-btn" data-act="closeSheet" aria-label="Close">${ICON.x}</button></div>`;
const searchBox = (list, ph) => `<label class="search">${ICON.search}<input data-q="${list}" placeholder="${ph}" autocomplete="off"></label>`;
const burnText = m => (+m.kcal ? `~${kc(m.kcal)} kcal burned` : 'workout');
const mealSub = m => (isWorkout(m) ? `Workout · ${burnText(m)}` : `${kc(+m.kcal || 0)} kcal · ${g(+m.p || 0)}g protein`);
const scheduleText = m => (m.daily?.length ? `${daysText(m.days) || 'Every day'} at ${m.daily.map(t12).join(', ')}` : '');
const match = (m, q) => m.title.toLowerCase().includes(q.trim().toLowerCase()) || (m.details || '').toLowerCase().includes(q.trim().toLowerCase());
const pickRows = (q, act) => {
  const list = libSorted().filter(m => match(m, q));
  if (!list.length) return `<p class="empty-line">${lib().length ? 'No meal matches that.' : 'No meals yet — send Claude a recipe, or add one in Meals.'}</p>`;
  return list.map(m => `<button class="pick" data-act="${act}" data-v="${esc(m.id)}"><span><b>${esc(m.title)}</b><small>${mealSub(m)}</small></span><i>${ICON.plus}</i></button>`).join('');
};
const LISTS = {
  food: q => pickRows(q, 'addExtraMeal'),
  plan: q => pickRows(q, 'pickSlot'),
  meals: q => mealRows(q),
};

/* ---------- actions ---------- */
const ACTIONS = {
  tab: v => { UI.tab = v; closeSheet(); render(); scrollTo(0, 0); },
  closeSheet,
  useLocal: () => { AUTH = { local: true }; write(AUTH_KEY, AUTH); render(); },
  toLogin: () => { AUTH = {}; localStorage.removeItem(AUTH_KEY); render(); },
  signOut: () => signOut(false),
  syncNow: () => (pushTimer ? push() : pull()),
  dayNav: v => { UI.date = v === 'today' ? today() : ymd(addDays(parse(UI.date), +v)); render(); },
  weekNav: v => { UI.week = ymd(addDays(parse(UI.week), +v)); UI.planDay = UI.week === weekOf(today()) ? dowIdx(today()) : 0; render(); },
  goPlan: v => { UI.week = v || weekOf(UI.date); UI.planDay = UI.week === weekOf(today()) ? dowIdx(today()) : 0; UI.tab = 'week'; render(); scrollTo(0, 0); },
  planDay: v => { UI.planDay = +v; render(); },
  // today
  openAdd: () => openSheet(`${sheetHead('Add food', 'Something you ate that wasn’t planned')}
    ${searchBox('food', 'Search your meals')}<div class="picklist" id="qlist">${LISTS.food('')}</div>
    <form class="quick" data-form="quick"><h4>Or quick add</h4><div class="qrow">
      <input id="qa-t" placeholder="e.g. 2 biscuits" autocomplete="off"><input id="qa-k" type="number" inputmode="numeric" placeholder="kcal">
      <button class="btn">Add</button></div></form>`),
  addExtraMeal: id => {
    const m = mealById(id);
    day(UI.date).extra.push({ title: m.title, mealId: m.id, kcal: +m.kcal || 0, p: +m.p || 0, c: +m.c || 0, f: +m.f || 0, fb: +m.fb || 0 });
    save(); closeSheet(); render(); toast(`Added ${m.title}`);
  },
  addQuick: () => {
    const t = $('#qa-t').value.trim();
    if (!t) return toast('Type what you had');
    day(UI.date).extra.push({ title: t, kcal: +$('#qa-k').value || 0, p: 0, c: 0, f: 0 });
    save(); closeSheet(); render(); toast(`Added ${t}`);
  },
  delExtra: v => { day(UI.date).extra.splice(+v, 1); save(); render(); },
  // plan
  openAddSlot: () => openSheet(`${sheetHead(`Add to ${DAY_LONG[UI.planDay]}`, short(addDays(parse(UI.week), UI.planDay)))}
    <label class="field">Time<input type="time" id="as-t" value="${esc(UI.lastTime || '')}"></label>
    ${searchBox('plan', 'Search your meals')}<div class="picklist" id="qlist">${LISTS.plan('')}</div>`),
  pickSlot: id => {
    const t = $('#as-t').value;
    UI.lastTime = t;
    menu(UI.week).slots.push({ id: 's' + uid(), day: UI.planDay, time: t, mealId: id });
    save(); closeSheet(); render(); toast(`Added ${mealById(id).title}`);
  },
  delSlot: id => { const m = menu(UI.week); m.slots = m.slots.filter(s => s.id !== id); save(); render(); },
  copyTo: v => {
    const m = menu(UI.week), from = UI.planDay, src = m.slots.filter(s => s.day === from);
    const targets = v === 'all' ? [0, 1, 2, 3, 4, 5, 6].filter(d => d !== from) : [+v];
    if (targets.some(d => m.slots.some(s => s.day === d)) && !confirm('Replace the meals already planned on those days?')) return;
    m.slots = m.slots.filter(s => !targets.includes(s.day)).concat(targets.flatMap(d => src.map(s => ({ ...s, id: 's' + uid(), day: d }))));
    save(); render(); toast(`Copied to ${v === 'all' ? 'the whole week' : DAY_LONG[+v]}`);
  },
  copyLastWeek: () => {
    const prev = slotsOf(ymd(addDays(parse(UI.week), -7)));
    if (planned(UI.week) && !confirm('Replace this week’s plan with last week’s?')) return;
    menu(UI.week).slots = prev.map(s => ({ ...s, id: 's' + uid() }));
    save(); render(); toast(`Copied ${prev.length} meals from last week`);
  },
  // meals
  openMeal: id => {
    const m = mealById(id);
    openSheet(`${sheetHead(esc(m.title), m.details ? esc(m.details) : '')}
      ${isWorkout(m) ? `<div class="bignut one"><div><b>${+m.kcal ? '~' + kc(m.kcal) : '–'}</b><small>kcal burned (estimate)</small></div></div>`
        : `<div class="bignut"><div><b>${kc(+m.kcal || 0)}</b><small>kcal</small></div><div><b>${g(+m.p || 0)}g</b><small>protein</small></div>
        <div><b>${g(+m.c || 0)}g</b><small>carbs</small></div><div><b>${g(+m.f || 0)}g</b><small>fat</small></div><div><b>${+(+m.fb || 0).toFixed(1)}g</b><small>fiber</small></div></div>`}
      ${m.daily?.length ? `<p class="dailynote">${ICON.repeat} ${scheduleText(m)}</p>` : ''}
      ${m.ingredients?.length ? `<h4>Recipe</h4><table class="ing"><tr><th>Ingredient</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr>
        ${m.ingredients.map(x => `<tr><td>${esc(x.name)}<small>${esc(x.qty)}</small></td><td>${kc(x.kcal)}</td><td>${+(+x.p).toFixed(1)}</td><td>${+(+x.c).toFixed(1)}</td><td>${+(+x.f).toFixed(1)}</td></tr>`).join('')}</table>` : ''}
      <div class="sh-actions"><button class="btn ghost" data-act="editMeal" data-v="${esc(m.id)}">Edit</button>
        <button class="btn ghost danger" data-act="delMeal" data-v="${esc(m.id)}">Delete</button></div>`);
  },
  newMeal: () => mealForm({ id: '', kind: 'food', title: '', details: '', kcal: '', p: '', c: '', f: '', daily: [], days: [] }),
  editMeal: id => mealForm(mealById(id)),
  saveMealForm: () => {
    const v = id => $(`#mf-${id}`).value.trim();
    if (!v('title')) return toast('Give the meal a name');
    const old = UI.editing?.id ? mealById(UI.editing.id) : null;
    const daily = parseTimes(v('daily'));
    const kind = document.querySelector('input[name="mf-kind"]:checked')?.value || 'food';
    const days = [...document.querySelectorAll('input[name="mf-day"]:checked')].map(x => +x.value);
    const m = {
      ...(old || {}), id: old?.id || (kind === 'workout' ? 'w' : 'm') + uid(), kind, title: v('title'), details: v('details'),
      kcal: +v('kcal') || 0, p: kind === 'workout' ? 0 : +v('p') || 0, c: kind === 'workout' ? 0 : +v('c') || 0, f: kind === 'workout' ? 0 : +v('f') || 0, fb: kind === 'workout' ? 0 : +v('fb') || 0,
      daily, days: days.length === 7 ? [] : days,
      from: daily.length ? old?.from || today() : '', ingredients: old?.ingredients || [],
    };
    closeSheet(); persistMeal(m); toast(`${kind === 'workout' ? 'Workout' : 'Meal'} saved`);
  },
  delMeal: id => {
    const m = mealById(id);
    if (!confirm(`Delete "${m.title}"? Days already planned keep its calories.`)) return;
    closeSheet(); removeMeal(id);
  },
  // profile
  openProfile: () => {
    const P = st().profile, h = +P.heightCm || 0, inch = h / 2.54, w = weightOn(today());
    openSheet(`${sheetHead('Your profile', 'Used to calculate your daily calories')}
      <form data-form="profile" class="form">
        <label class="field">Date of birth<input type="date" id="pf-dob" value="${esc(P.dob)}" required></label>
        <div class="field">Sex<div class="seg">${[['male', 'Male'], ['female', 'Female']].map(([v, l]) => `<label><input type="radio" name="pf-sex" value="${v}" ${P.sex === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
        <div class="field">Height<div class="two"><label class="unit"><input type="number" inputmode="numeric" id="pf-ft" value="${h ? Math.floor(inch / 12) : ''}" placeholder="5" required><span>ft</span></label>
          <label class="unit"><input type="number" inputmode="decimal" id="pf-in" value="${h ? +(inch % 12).toFixed(1) : ''}" placeholder="6" step="0.5"><span>in</span></label></div></div>
        <label class="field">Current weight<span class="unit"><input type="number" inputmode="decimal" step="0.1" id="pf-kg" value="${w || ''}" placeholder="0.0" required><span>kg</span></span></label>
        <label class="field">How active are you?<select id="pf-act">${Object.entries(ACTIVITY).map(([k, [, l]]) => `<option value="${k}" ${P.activity === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Goal<select id="pf-goal">${Object.entries(GOALS).map(([k, [, l]]) => `<option value="${k}" ${P.goal === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <button class="btn wide">Save</button></form>`);
  },
  saveProfile: () => {
    const P = st().profile;
    P.dob = $('#pf-dob').value;
    P.sex = document.querySelector('input[name="pf-sex"]:checked')?.value || 'male';
    P.heightCm = Math.round(((+$('#pf-ft').value || 0) * 12 + (+$('#pf-in').value || 0)) * 2.54 * 10) / 10;
    P.activity = $('#pf-act').value; P.goal = $('#pf-goal').value;
    const kg = +$('#pf-kg').value;
    if (kg && kg !== weightOn(today())) S.weights[today()] = kg;
    save(); closeSheet(); render(); toast('Profile saved');
  },
  exportXlsx: () => exportXlsx(),
  importXlsx: () => $('#importFile').click(),
  reset: () => {
    if (confirm('Erase all data on this device?') && prompt('Type DELETE to confirm') === 'DELETE') {
      S = structuredClone(DEFAULT); save(); render(); toast('All data cleared');
    }
  },
};
function mealForm(m) {
  UI.editing = m;
  openSheet(`${sheetHead(m.id ? `Edit ${isWorkout(m) ? 'workout' : 'meal'}` : 'New meal or workout', m.id ? '' : 'Tip: send Claude the recipe and it calculates everything for you')}
    <form data-form="meal" class="form">
      <div class="field">Type<div class="seg">${[['food', 'Meal'], ['workout', 'Workout']].map(([v, l]) => `<label><input type="radio" name="mf-kind" value="${v}" ${(m.kind || 'food') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <label class="field">Name<input id="mf-title" value="${esc(m.title)}" placeholder="Overnight oats" required data-focus></label>
      <label class="field">Details<textarea id="mf-details" rows="2" placeholder="Oats 50 g, milk 200 ml, banana…">${esc(m.details)}</textarea></label>
      <div class="four">${[['kcal', '<span class="lf">Calories</span><span class="lw">kcal burned (estimate)</span>'], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g'], ['fb', 'Fiber g']].map(([k, l]) => `<label class="field ${k === 'kcal' ? '' : 'food-only'}">${l}<input type="number" inputmode="decimal" step="0.1" id="mf-${k}" value="${esc(m[k])}"></label>`).join('')}</div>
      <label class="field">Repeats at <small>optional — e.g. 7:00 AM, 5:00 PM</small><input id="mf-daily" value="${esc((m.daily || []).map(t12).join(', '))}" placeholder="Leave empty to plan it day by day"></label>
      <div class="field">On these days<div class="daypick">${DAY3.map((d, i) => `<label><input type="checkbox" name="mf-day" value="${i}" ${!m.days?.length || m.days.includes(i) ? 'checked' : ''}><span>${d[0]}</span></label>`).join('')}</div></div>
      <button class="btn wide">Save meal</button></form>`);
}

/* ---------- views ---------- */
const UI = {
  tab: 'today', date: today(),
  // on Sunday you plan the coming week, so Plan opens on next week
  week: ymd(addDays(monday(new Date()), new Date().getDay() === 0 ? 7 : 0)),
  planDay: new Date().getDay() === 0 ? 0 : dowIdx(today()),
};
const TABS = [['today', 'Today', ICON.today], ['week', 'Plan', ICON.plan], ['meals', 'Meals', ICON.meals], ['stats', 'Progress', ICON.progress]];
const VIEWS = { today: viewToday, week: viewPlan, meals: viewMeals, stats: viewStats, settings: viewSettings };

function render() {
  const app = $('#app');
  if (!signedIn() && !localMode()) { app.className = 'auth'; app.innerHTML = viewLogin(); return; }
  app.className = '';
  app.innerHTML = `
    <header class="top"><div class="top-in">
      <div class="brand"><span class="mark"></span>Growth</div>
      <nav class="tabs">${TABS.map(([id, l]) => `<button class="tab ${UI.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}">${l}</button>`).join('')}</nav>
      <button class="avatar ${UI.tab === 'settings' ? 'on' : ''}" data-act="tab" data-v="settings" data-sync="${syncState}" aria-label="Account & settings">${esc(APP.name[0])}</button>
    </div></header>
    <main>${VIEWS[UI.tab]()}</main>
    <nav class="bnav">${TABS.map(([id, l, ic]) => `<button class="${UI.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}">${ic}<span>${l}</span></button>`).join('')}</nav>`;
}
function refreshLive() {
  const h = $('[data-live="hero"]'); if (h) h.innerHTML = hero(UI.date);
  const n = $('[data-live="numbers"]'); if (n) n.innerHTML = numbersBox();
  const w = $('[data-live="weektarget"]'); if (w) w.innerHTML = weekTarget(w.dataset.k);
}

function viewLogin() {
  const head = `<div class="mark big"></div>`;
  if (!APP.backend) return `<div class="login">${head}<h1>Growth</h1><p class="sub">Plan your meals, hit your calories, watch your weight.</p>
    <div class="card"><p>Your account isn’t connected to a Google Sheet yet. You can start on this device now — when the Sheet is connected, sign in and everything moves there.</p>
    <button class="btn wide" data-act="useLocal">Start on this device</button></div></div>`;
  return `<div class="login">${head}<h1>Welcome back, ${esc(APP.name)}</h1><p class="sub">Sign in to see your plan on this device</p>
    <form class="card" data-form="login">
      <label class="field">Password<input type="password" id="pw" autocomplete="current-password" required autofocus></label>
      ${UI.loginErr ? `<p class="err">${esc(UI.loginErr)}</p>` : ''}
      <button class="btn wide" ${UI.loginBusy ? 'disabled' : ''}>${UI.loginBusy ? 'Signing in…' : 'Sign in'}</button></form>
    <button class="link" data-act="useLocal">Use without signing in</button></div>`;
}

const pageHead = (title, sub, nav = '') => `<div class="phead"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${nav ? `<div class="pnav">${nav}</div>` : ''}</div>`;
const arrows = (act, back, fwd) => `<button class="icon-btn" data-act="${act}" data-v="${back}" aria-label="Previous">${ICON.left}</button><button class="icon-btn" data-act="${act}" data-v="${fwd}" aria-label="Next">${ICON.right}</button>`;

function hero(k) {
  // what you planned for the day vs what you've ticked as eaten
  const T = totals(k), plan = T.planned.kcal, eaten = T.eaten.kcal, left = plan - eaten;
  const C = 2 * Math.PI * 52, pct = plan ? Math.min(eaten / plan, 1) : 0;
  const bar = (label, key, cls) => { const v = T.eaten[key], goal = T.planned[key], dp = key === 'fb' ? 1 : 0;
    return `<div class="mb ${cls}"><div class="mbh"><span>${label}</span><span><b>${+v.toFixed(dp)}</b> / ${+goal.toFixed(dp)}g</span></div>
    <div class="mbt"><i style="width:${goal ? Math.min(v / goal, 1) * 100 : 0}%"></i></div></div>`; };
  return `<div class="ringwrap">
      <svg viewBox="0 0 120 120" class="ring"><circle class="trk" cx="60" cy="60" r="52"/>
        ${pct ? `<circle class="val ${left < 0 ? 'over' : ''}" cx="60" cy="60" r="52" stroke-dasharray="${C * pct} ${C}"/>` : ''}</svg>
      <div class="ringtxt"><b>${kc(plan ? Math.abs(left) : eaten)}</b><small>${!plan ? 'kcal eaten' : left >= 0 ? 'kcal left' : 'kcal over plan'}</small></div>
    </div>
    <div class="herostats">
      <div class="hs two"><div><small>Eaten</small><b>${kc(eaten)}</b></div><div><small>Planned</small><b>${kc(plan)}</b></div></div>
      ${bar('Protein', 'p', 'p')}${bar('Carbs', 'c', 'c')}${bar('Fat', 'f', 'f')}${bar('Fiber', 'fb', 'fb')}
    </div>`;
}
const PERIODS = [['Morning', '00:00', '12:00'], ['Afternoon', '12:00', '17:00'], ['Evening', '17:00', '21:00'], ['Night', '21:00', '99:99']];
const periodOf = t => (t ? PERIODS.find(([, a, b]) => t >= a && t < b)[0] : 'Anytime');

function viewToday() {
  const k = UI.date, dt = parse(k), isToday = k === today(), d = day(k);
  const rel = { [today()]: 'Today', [ymd(addDays(new Date(), -1))]: 'Yesterday', [ymd(addDays(new Date(), 1))]: 'Tomorrow' }[k];
  const slots = slotsOn(k), late = isToday ? nowHM() : k < today() ? '99:99' : '';
  const groups = {};
  slots.forEach(s => (groups[periodOf(s.time)] ??= []).push(s));
  const row = s => {
    const m = slotMeal(s), w = isWorkout(m);
    return `<label class="item ${w ? 'workout' : ''} ${s.time && s.time < late ? 'late' : ''}">
      <input type="checkbox" data-p="days.${k}.ate.${s.id}" ${ate(k, s) ? 'checked' : ''}>
      <span class="tick">${ICON.check}</span>
      <span class="item-main"><b>${esc(m.title)}</b><small>${t12(s.time) || 'Any time'} · ${w ? burnText(m) : `${kc(+m.kcal || 0)} kcal${g(+m.p || 0) ? ` · ${g(m.p)}g protein` : ''}`}</small></span>
      ${w ? `<span class="tag-w">${ICON.run}Workout</span>` : s.daily ? `<span class="chip-daily" title="Repeats">${ICON.repeat}</span>` : ''}</label>`;
  };
  const list = slots.length ? Object.entries(groups).map(([name, items]) => {
    const done = items.filter(s => ate(k, s)).length;
    return `<section class="group"><div class="ghead"><h4>${name}</h4><span>${done}/${items.length}</span></div><div class="card list">${items.map(row).join('')}</div></section>`;
  }).join('') : `<div class="card empty"><b>Nothing planned for ${rel ? rel.toLowerCase() : 'this day'}</b><p>Plan your week on Sunday — it takes two minutes.</p>
    <button class="btn" data-act="goPlan" data-v="${weekOf(k)}">Plan this week</button></div>`;
  const extras = d.extra.length ? `<section class="group"><div class="ghead"><h4>Extra</h4><span>${kc(sumN(d.extra).kcal)} kcal</span></div><div class="card list">
    ${d.extra.map((x, i) => `<div class="item static"><span class="item-main"><b>${esc(x.title)}</b><small>${kc(x.kcal)} kcal${x.p ? ` · ${g(x.p)}g protein` : ''}</small></span>
      <button class="icon-btn sm" data-act="delExtra" data-v="${i}" aria-label="Remove">${ICON.x}</button></div>`).join('')}</div></section>` : '';
  const setup = !profileReady() ? `<button class="card setup" data-act="openProfile"><span><b>Set up your profile</b><small>30 seconds — so your calorie target is calculated for you</small></span>${ICON.right}</button>` : '';
  const weigh = dt.getDay() === 0 && profileReady() ? `<section class="card weigh"><div><b>Sunday weigh-in</b><small>Morning, before eating</small></div>
    <label class="unit lg">${num(`weights.${k}`, 'step="0.1" min="0" placeholder="0.0"')}<span>kg</span></label></section>` : '';

  return `
  ${pageHead(rel || DOW_LONG[dt.getDay()], `${rel ? DOW_LONG[dt.getDay()] + ', ' : ''}${dt.getDate()} ${MONTHS_LONG[dt.getMonth()]}`,
    `${isToday ? '' : '<button class="btn ghost sm" data-act="dayNav" data-v="today">Today</button>'}${arrows('dayNav', -1, 1)}`)}
  ${setup}${weigh}
  <section class="card hero" data-live="hero">${hero(k)}</section>
  ${list}${extras}
  <button class="addbtn" data-act="openAdd">${ICON.plus} Add food</button>`;
}

const weekTarget = k => {
  const T = target(k);
  return `<small>Target / day</small><b>${kc(T.kcal)}</b><span>${T.ok ? `maintain ${kc(T.tdee)}` : 'set up profile'}</span>`;
};
function viewPlan() {
  const ws = UI.week, start = parse(ws), end = addDays(start, 6), sun = ymd(addDays(start, -1));
  const m = menu(ws), thisWeek = weekOf(today()), tgt = target(sun).kcal, sd = UI.planDay, date = ymd(addDays(start, sd));
  const tag = ws === thisWeek ? 'This week' : ws === ymd(addDays(parse(thisWeek), 7)) ? 'Next week' : ws < thisWeek ? 'Past week' : '';
  const food = dk => slotsOn(dk).filter(s => !isW(s));
  const T = sumN(weekKeys(ws).flatMap(food).map(slotMeal));
  const pills = weekKeys(ws).map((dk, i) => {
    const kcal = sumN(food(dk).map(slotMeal)).kcal, mine = m.slots.some(s => s.day === i), off = mine && tgt && Math.abs(kcal - tgt) > tgt * 0.1;
    return `<button class="dpill ${i === sd ? 'on' : ''} ${dk === today() ? 'is-today' : ''}" data-act="planDay" data-v="${i}">
      <small>${DAY_ONE[i]}</small><b>${parse(dk).getDate()}</b><span class="${off ? 'off' : mine ? 'ok' : ''}">${kcal ? (kcal / 1000).toFixed(1) + 'k' : '–'}</span></button>`;
  }).join('');
  const items = slotsOn(date), DT = sumN(food(date).map(slotMeal)), mine = m.slots.filter(s => s.day === sd);
  const rows = items.map(s => {
    const meal = slotMeal(s);
    const w = isWorkout(meal), sub = w ? burnText(meal) : `${kc(+meal.kcal || 0)} kcal`;
    if (s.daily) return `<div class="item static daily ${w ? 'workout' : ''}"><span class="time">${t12(s.time)}</span><span class="item-main"><b>${esc(meal.title)}</b><small>${sub} · ${daysText(meal.days) || 'every day'}</small></span>${w ? `<span class="tag-w">${ICON.run}</span>` : `<span class="chip-daily">${ICON.repeat}</span>`}</div>`;
    return `<div class="item static ${w ? 'workout' : ''}"><input type="time" class="time-in" data-p="menus.${ws}.slots.${m.slots.indexOf(s)}.time" value="${esc(s.time)}">
      <span class="item-main"><b>${esc(meal.title)}</b><small>${w ? sub : `${sub} · ${g(+meal.p || 0)}g protein`}</small></span>
      <button class="icon-btn sm" data-act="delSlot" data-v="${s.id}" aria-label="Remove">${ICON.x}</button></div>`;
  }).join('');
  const over = tgt && DT.kcal > tgt * 1.1, under = tgt && DT.kcal < tgt * 0.9;
  return `
  ${pageHead('Plan', `${short(start)} – ${short(end)}${tag ? ` · ${tag}` : ''}`, arrows('weekNav', -7, 7))}
  <section class="card wsum">
    <label class="ws"><small>Sunday weigh-in</small><span class="unit">${num(`weights.${sun}`, 'step="0.1" min="0" placeholder="–"')}<span>kg</span></span></label>
    <div class="ws" data-live="weektarget" data-k="${sun}">${weekTarget(sun)}</div>
    <div class="ws"><small>Planned / day</small><b>${T.kcal ? kc(T.kcal / 7) : '–'}</b><span>${T.kcal ? `${g(T.p / 7)}g protein` : 'nothing yet'}</span></div>
  </section>
  ${!planned(ws) && planned(ymd(addDays(start, -7))) ? `<button class="card setup" data-act="copyLastWeek"><span><b>Copy last week’s plan</b><small>Start from what you ate last week, then tweak</small></span>${ICON.copy}</button>` : ''}
  <div class="dpills">${pills}</div>
  <section class="card dayplan">
    <div class="dhead"><div><h3>${DAY_LONG[sd]}</h3><small>${short(parse(date))}</small></div>
      <div class="dtot ${over ? 'over' : under && DT.kcal ? 'under' : ''}"><b>${kc(DT.kcal)}</b> / ${kc(tgt)} kcal</div></div>
    <div class="mbt big"><i class="${over ? 'over' : ''}" style="width:${tgt ? Math.min(DT.kcal / tgt, 1) * 100 : 0}%"></i></div>
    <div class="list">${rows || '<p class="empty-line">No meals yet for this day.</p>'}</div>
    <button class="addbtn in" data-act="openAddSlot">${ICON.plus} Add meal or workout</button>
    ${mine.length ? `<div class="copyrow"><span>${ICON.copy} Copy to</span>${[0, 1, 2, 3, 4, 5, 6].filter(x => x !== sd).map(x => `<button class="chip" data-act="copyTo" data-v="${x}">${DAY_LONG[x].slice(0, 3)}</button>`).join('')}
      <button class="chip" data-act="copyTo" data-v="all">All</button></div>` : ''}
  </section>`;
}

function mealRows(q = '') {
  const list = libSorted().filter(m => match(m, q));
  if (!list.length) return `<p class="empty-line">${lib().length ? 'Nothing matches that.' : ''}</p>`;
  const rows = items => `<div class="card list">${items.map(m => `<button class="item" data-act="openMeal" data-v="${esc(m.id)}">
    <span class="item-main"><b>${esc(m.title)}</b><small>${isWorkout(m) ? burnText(m) : `${kc(+m.kcal || 0)} kcal · P ${g(+m.p || 0)} · C ${g(+m.c || 0)} · F ${g(+m.f || 0)}`}</small></span>
    ${m.daily?.length ? `<span class="chip-daily wide">${isWorkout(m) ? ICON.run : ICON.repeat}<span>${esc(scheduleText(m).replace('Every day at ', ''))}</span></span>` : ''}<i class="chev">${ICON.right}</i></button>`).join('')}</div>`;
  const W = list.filter(isWorkout), M = list.filter(m => !isWorkout(m));
  return `${W.length ? `<section class="group first"><div class="ghead"><h4>Workouts</h4><span>${W.length}</span></div>${rows(W)}</section>` : ''}
    ${M.length ? `<section class="group ${W.length ? '' : 'first'}"><div class="ghead"><h4>Meals</h4><span>${M.length}</span></div>${rows(M)}</section>` : ''}`;
}
function viewMeals() {
  const n = lib().length;
  return `
  ${pageHead('Meals', `${n} saved`, `<button class="btn sm" data-act="newMeal">${ICON.plus} New</button>`)}
  ${n ? `${searchBox('meals', 'Search meals')}` : ''}
  <div id="qlist">${mealRows('')}</div>
  <div class="tip"><b>Add meals the easy way</b> — send Claude the recipe with grams (e.g. “Poha: poha 60 g, peanuts 10 g, oil 1 tsp…”).
    It calculates exact calories, protein, carbs & fat and adds it ${signedIn() ? 'to the Meals tab of your Google Sheet' : 'here'}.</div>`;
}

function weightChart(list) {
  if (list.length < 2) return `<p class="empty-line">Weigh in each Sunday — your trend line appears after two weigh-ins.</p>`;
  const W = 600, H = 190, px = 36, py = 34, ys = list.map(x => x.kg), lo = Math.min(...ys) - 0.5, hi = Math.max(...ys) + 0.5;
  const X = i => px + (i * (W - 2 * px)) / (list.length - 1), Y = v => py + ((hi - v) / (hi - lo)) * (H - 2 * py);
  return `<svg class="wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">
    <polyline points="${list.map((x, i) => `${X(i)},${Y(x.kg)}`).join(' ')}"/>
    ${list.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.kg)}" r="6"/><text x="${X(i)}" y="${Y(x.kg) - 14}">${x.kg}</text>
      <text class="d" x="${X(i)}" y="${H - 4}">${short(parse(x.k))}</text>`).join('')}</svg>`;
}
function viewStats() {
  const now = new Date(), k = today(), thisWeek = weekOf(k), TG = target();
  const W = weights(), last = W.at(-1), prev = W.at(-2), first = W[0];
  const last30 = [...Array(30)].map((_, i) => ymd(addDays(now, -i)));
  const s30 = planSum(last30), sw = planSum(weekKeys(thisWeek)), ww = planSum(weekKeys(thisWeek), true), w30 = planSum(last30, true);
  const done7 = [...Array(7)].map((_, i) => ymd(addDays(now, -1 - i))).map(totals).filter(T => T.eaten.kcal > 0);
  const avg = key => (done7.length ? done7.reduce((a, T) => a + T.eaten[key], 0) / done7.length : null);

  const last14 = [...Array(14)].map((_, i) => ymd(addDays(now, i - 13)));
  const max = Math.max(TG.kcal * 1.3, ...last14.map(dk => totals(dk).eaten.kcal), 1);
  const calBars = last14.map(dk => {
    const e = totals(dk).eaten.kcal, t = target(dk).kcal, cls = !e ? 'nil' : e > t * 1.1 ? 'over' : e < t * 0.85 ? 'under' : '';
    return `<div title="${dk}: ${kc(e)} kcal"><span class="bar"><i class="${cls}" style="height:${(e / max) * 100}%"></i></span><small>${DOW[parse(dk).getDay()][0]}</small></div>`;
  }).join('');
  const startW = addDays(monday(now), -7 * 15);
  const heat = workouts => [...Array(16 * 7)].map((_, i) => {
    const d = addDays(startW, i), dk = ymd(d);
    if (d > now) return '<i class="future"></i>';
    const a = adherence(dk, true, workouts);
    return a ? `<i class="lv${a.pct <= 0 ? 0 : a.pct < 0.4 ? 1 : a.pct < 0.7 ? 2 : a.pct < 1 ? 3 : 4}" title="${dk}: ${a.done}/${a.n}"></i>` : `<i class="lv0 none" title="${dk}"></i>`;
  }).join('');
  const by = {};
  last30.forEach(dk => {
    const all = slotsOn(dk).filter(s => !isW(s)), due = dk === k ? all.filter(s => ate(dk, s) || (s.time && s.time <= nowHM())) : all;
    due.forEach(sl => { const m = slotMeal(sl), r = (by[m.title] ??= { title: m.title, n: 0, done: 0 }); r.n++; if (ate(dk, sl)) r.done++; });
  });
  const missed = Object.values(by).filter(r => r.done < r.n).sort((a, b) => a.done / a.n - b.done / b.n).slice(0, 5);

  return `
  ${pageHead('Progress', 'How you’re doing')}
  <div class="kpis">
    <div class="card kpi"><small>Weight</small><b>${last ? last.kg : '–'}<span>kg</span></b><em class="${prev && last.kg < prev.kg ? 'good' : ''}">${prev ? kgDiff(last.kg - prev.kg) + ' this week' : 'weigh in on Sunday'}</em></div>
    <div class="card kpi"><small>Avg calories</small><b>${avg('kcal') == null ? '–' : kc(avg('kcal'))}</b><em>last 7 days · target ${kc(TG.kcal)}</em></div>
    <div class="card kpi"><small>Meals as planned</small><b>${pctText(sw.pct)}</b><em>this week · ${ICON.flame} ${planStreak()} day streak</em></div>
    <div class="card kpi"><small>Workouts</small><b>${ww.n ? `${ww.done}/${ww.n}` : '–'}</b><em>this week · ${ICON.flame} ${workoutStreak()} in a row</em></div>
  </div>
  <section class="card"><div class="chead"><h3>Weight</h3>${W.length > 1 ? `<span class="pill ${last.kg <= first.kg ? 'good' : ''}">${kgDiff(last.kg - first.kg)} since ${short(parse(first.k))}</span>` : ''}</div>
    ${weightChart(W.slice(-12))}
    ${TG.ok ? `<p class="note">At ${TG.kg} kg you maintain on <b>${kc(TG.tdee)} kcal</b>. Your target is <b>${kc(TG.kcal)} kcal</b> and <b>${TG.protein}g protein</b> a day.</p>` : ''}</section>
  <section class="card"><div class="chead"><h3>Calories</h3><span class="muted">last 14 days</span></div>
    <div class="cbars" style="--t:${(TG.kcal / max) * 100}%">${calBars}</div>
    <div class="legend"><span><i class="ok"></i>On target</span><span><i class="over"></i>Over 10%+</span><span><i class="under"></i>Under 15%+</span><span><i class="line"></i>Target</span></div>
    <p class="note">Average protein, last 7 days: <b>${avg('p') == null ? '–' : g(avg('p')) + 'g'}</b> of ${TG.protein}g.</p></section>
  <section class="card"><div class="chead"><h3>Consistency</h3><span class="muted">last 16 weeks</span></div>
    <div class="heats"><div><h4>Meals <span>${s30.hit}/${s30.days} days on plan</span></h4><div class="heat">${heat(false)}</div></div>
      <div><h4>Workouts <span>${w30.done}/${w30.n} done</span></h4><div class="heat w">${heat(true)}</div></div></div>
    <p class="note">Each square is a day, Monday on top. Darker = more done. Faded = nothing planned (rest day).</p></section>
  ${missed.length ? `<section class="card"><div class="chead"><h3>Most often skipped</h3><span class="muted">last 30 days</span></div>
    <div class="list">${missed.map(r => `<div class="item static"><span class="item-main"><b>${esc(r.title)}</b><small>done ${r.done} of ${r.n} times</small></span>
      <div class="mini-meter"><i style="width:${(r.done / r.n) * 100}%"></i></div></div>`).join('')}</div></section>` : ''}`;
}

function numbersBox() {
  const T = target();
  if (!T.ok) return `<p class="empty-line">Add your profile to calculate your numbers.</p>`;
  return `<div class="nums">
    <div><small>Weight</small><b>${T.kg} kg</b><span>BMI ${T.bmi.toFixed(1)}</span></div>
    <div><small>Maintenance</small><b>${kc(T.tdee)}</b><span>kcal / day</span></div>
    <div class="hl"><small>Your target</small><b>${kc(T.kcal)}</b><span>kcal / day</span></div>
    <div><small>Protein</small><b>${T.protein}g</b><span>per day</span></div></div>
    ${T.floored ? '<p class="note">That goal would go below your BMR, so the target is held at BMR.</p>' : ''}
    <p class="note">Recalculated automatically from every weigh-in (BMR ${kc(T.bmr)} kcal · age ${T.age}).</p>`;
}
function viewSettings() {
  const P = st().profile;
  return `
  ${pageHead('Account', '')}
  <section class="card acct"><div class="avatar lg">${esc(APP.name[0])}</div>
    <div class="acct-main"><b>${esc(APP.name)}</b><small id="syncStatus">${signedIn() ? syncText() : 'Using this device only — not signed in'}</small></div>
    ${signedIn() ? `<button class="btn ghost sm" data-act="syncNow">Sync</button>` : APP.backend ? `<button class="btn sm" data-act="toLogin">Sign in</button>` : ''}</section>
  <section class="card"><div class="chead"><h3>Profile & targets</h3><button class="btn ghost sm" data-act="openProfile">${P.dob ? 'Edit' : 'Set up'}</button></div>
    ${P.dob ? `<p class="muted">${esc((ACTIVITY[P.activity] || ACTIVITY.light)[1])} · ${esc((GOALS[P.goal] || GOALS.maintain)[1])}</p>` : ''}
    <div data-live="numbers">${numbersBox()}</div>
    <details class="adv"><summary>Advanced</summary>
      <label class="field">Protein per kg body weight${num('settings.profile.proteinPerKg', 'min="0.8" max="3" step="0.1"')}</label>
      <label class="field">Fixed calorie target <small>blank = calculated</small>${num('settings.kcalOverride', 'min="0" step="50"')}</label>
      <label class="field">Fixed protein target (g) <small>blank = calculated</small>${num('settings.proteinOverride', 'min="0"')}</label>
      <label class="field">% of a day’s meals eaten to count as “on plan”${num('settings.planHit', 'min="1" max="100"')}</label>
    </details></section>
  <section class="card"><h3>Your data</h3>
    <p class="muted">${signedIn() ? 'Everything lives in your Google Sheet — tabs Meals, Daily, Meal log and Weight. Download an Excel copy any time.' : 'Saved in this browser. Download an Excel copy as a backup.'}</p>
    <div class="btnrow"><button class="btn ghost" data-act="exportXlsx">Download Excel</button>${signedIn() ? '' : '<button class="btn ghost" data-act="importXlsx">Restore from Excel</button>'}</div>
    ${signedIn() ? '' : '<button class="link danger" data-act="reset">Erase data on this device</button>'}</section>
  ${signedIn() ? '<button class="btn ghost wide danger" data-act="signOut">Sign out</button>' : ''}`;
}

/* ---------- Excel ---------- */
// readable tables — the Excel download and the Sheet's Daily / Meal log / Weight tabs
function buildSheets() {
  const keys = new Set(Object.keys(S.days));
  Object.keys(S.menus).forEach(ws => { if (planned(ws)) weekKeys(ws).forEach(k => k <= today() && keys.add(k)); });
  Object.keys(S.weights).forEach(k => keys.add(k));
  const sorted = [...keys].filter(k => k <= today()).sort();
  const daily = sorted.map(k => {
    const T = totals(k), a = adherence(k), tgt = target(k).kcal;
    return {
      Date: k, Day: DOW[parse(k).getDay()], 'Weight kg': +S.weights[k] || '',
      'Target kcal': tgt, 'Planned kcal': g(T.planned.kcal), 'Eaten kcal': g(T.eaten.kcal), 'vs target': T.eaten.kcal ? g(T.eaten.kcal - tgt) : '',
      'Protein g': g(T.eaten.p), 'Carbs g': g(T.eaten.c), 'Fat g': g(T.eaten.f), 'Fiber g': +T.eaten.fb.toFixed(1),
      'Meals eaten': a ? `${a.done} of ${a.n}` : '', 'Workouts done': (w => (w ? `${w.done} of ${w.n}` : ''))(adherence(k, true, true)), 'Plan %': a ? Math.round(a.pct * 100) : '', 'Extra kcal': g(T.extra.kcal),
    };
  });
  const log = [];
  sorted.forEach(k => {
    slotsOn(k).forEach(s => {
      const m = slotMeal(s);
      log.push({ Date: k, Day: DOW[parse(k).getDay()], Time: t12(s.time), Type: isWorkout(m) ? 'Workout' : 'Meal', Meal: m.title, kcal: g(m.kcal), 'Protein g': g(m.p), 'Carbs g': g(m.c), 'Fat g': g(m.f), 'Fiber g': +(+m.fb || 0).toFixed(1), Eaten: ate(k, s) ? 'Yes' : 'No' });
    });
    (S.days[k]?.extra || []).forEach(x => log.push({ Date: k, Day: DOW[parse(k).getDay()], Time: '', Type: 'Extra', Meal: x.title + ' (extra)', kcal: g(x.kcal), 'Protein g': g(x.p), 'Carbs g': g(x.c), 'Fat g': g(x.f), 'Fiber g': +(+x.fb || 0).toFixed(1), Eaten: 'Yes' }));
  });
  return { Daily: daily, 'Meal log': log, Weight: weights().map(w => ({ Date: w.k, 'Weight kg': w.kg })) };
}
function exportXlsx() {
  if (!window.XLSX) return toast('Excel library not loaded — check your connection');
  const wb = XLSX.utils.book_new();
  const add = (rows, name) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '(empty)': '' }]);
    ws['!cols'] = Object.keys(rows[0] || {}).map(h => ({ wch: Math.min(40, Math.max(h.length + 2, ...rows.map(r => String(r[h] ?? '').length))) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  const meals = libSorted().map(m => ({ Meal: m.title, Type: isWorkout(m) ? 'Workout' : 'Meal', Days: daysText(m.days) || 'Every day', kcal: +m.kcal || 0, 'Protein g': +m.p || 0, 'Carbs g': +m.c || 0, 'Fat g': +m.f || 0, 'Fiber g': +m.fb || 0, 'Every day at': (m.daily || []).join(', '), Details: m.details || '' }));
  Object.entries({ Meals: meals, ...buildSheets() }).forEach(([name, rows]) => add(rows, name));
  // full machine-readable copy so Restore can bring everything back exactly
  S.lastExport = today();
  const json = JSON.stringify(S), chunks = [];
  for (let i = 0; i < json.length; i += 30000) chunks.push({ chunk: json.slice(i, i + 30000) });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chunks), '_backup');
  XLSX.writeFile(wb, `growth-${today()}.xlsx`);
  save(); toast('Excel downloaded');
}
async function importXlsx(file) {
  try {
    const wb = XLSX.read(await file.arrayBuffer());
    const ws = wb.Sheets._backup;
    if (!ws) return toast('Use a file downloaded from this app');
    const json = XLSX.utils.sheet_to_json(ws).map(r => r.chunk).join('');
    if (!confirm('Replace the data on this device with this file?')) return;
    S = merge(structuredClone(DEFAULT), JSON.parse(json));
    save(); render(); toast('Restored');
  } catch (e) {
    toast('Restore failed: ' + e.message);
  } finally {
    $('#importFile').value = '';
  }
}

/* ---------- misc ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

render();
pull();
