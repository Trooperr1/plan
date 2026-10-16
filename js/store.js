/* Persistent app state (saved in this browser's localStorage) with simple change notifications. */
(function () {
  const App = window.App;
  const U = App.util;
  const KEY = 'dailyPlanner.data.v2';
  const listeners = new Set();
  let state = null;
  let warnedStorage = false;

  const DEFAULT_CATEGORIES = [
    { id: 'personal', name: 'Personal', color: '#6366f1' },
    { id: 'work', name: 'Work', color: '#0ea5e9' },
    { id: 'health', name: 'Health', color: '#22c55e' },
    { id: 'study', name: 'Study', color: '#f59e0b' },
    { id: 'finance', name: 'Finance', color: '#ec4899' },
    { id: 'home', name: 'Home', color: '#14b8a6' },
  ];
  const FALLBACK_CATEGORY = { id: '', name: 'Other', color: '#94a3b8' };

  function defaults() {
    return {
      version: 1,
      tasks: [],
      events: [],
      habits: [],
      goals: [],
      days: {}, // per-day notes: { 'YYYY-MM-DD': { focus, notes, mood } }
      years: {}, // per-year info: { '2026': { theme } }
      reviews: {}, // weekly reviews by week-end (Sunday) date: { notes, seen }
      notified: {}, // reminders already shown
      money: { entries: [], bills: [], budget: null }, // spending, income, monthly bills
      meta: { createdAt: Date.now(), lastBackup: null, backupSnooze: null, installTipDismissed: false },
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      settings: {
        name: '',
        theme: 'system',
        weekStart: 1,
        clock: '12',
        notifications: false,
        sound: true,
        defaultReminder: 15,
        showHabits: false,
        currency: '',
        lang: 'ckb',
      },
    };
  }

  /* ---- Cleaning: saved data and imported backups may be old, broken or hand-edited.
     Every value is checked so the app never shows (or runs) something unexpected. ---- */
  const RE_ID = /^[\w-]{1,64}$/;
  const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const RE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const RE_COLOR = /^#[0-9a-f]{3,8}$/i;
  const REPEAT_KEYS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'];
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v) => (typeof v === 'string' && RE_ID.test(v) ? v : U.uid());
  const str = (v, max) => (v == null ? '' : String(v)).slice(0, max || 2000);
  const date = (v, fallback) => (typeof v === 'string' && RE_DATE.test(v) ? v : fallback);
  const time = (v, fallback) => (typeof v === 'string' && RE_TIME.test(v) ? v : fallback);
  const color = (v, fallback) => (typeof v === 'string' && RE_COLOR.test(v) ? v : fallback);
  const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
  const num = (v, fallback) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v));
  const int = (v, lo, hi, fallback) => {
    const n = num(v, null);
    if (n === null) return fallback;
    return Math.min(hi, Math.max(lo, Math.round(n)));
  };
  const arr = (v) => (Array.isArray(v) ? v : []);
  const dateMap = (v) => {
    const out = {};
    if (isObj(v)) Object.keys(v).forEach((k) => { if (RE_DATE.test(k) && v[k]) out[k] = true; });
    return out;
  };
  const catId = (v) => (typeof v === 'string' && RE_ID.test(v) ? v : defaultCategory());
  const reminder = (v) => (v == null || v === '' ? null : int(v, 0, 10080, null));

  function cleanTask(raw) {
    const t = newTask(isObj(raw) ? raw : {});
    t.id = id(t.id);
    t.title = str(t.title, 200);
    t.notes = str(t.notes);
    t.date = date(t.date, null);
    t.time = time(t.time, null);
    t.priority = oneOf(t.priority, ['low', 'medium', 'high'], 'medium');
    t.repeat = oneOf(t.repeat, REPEAT_KEYS, 'none');
    if (t.repeat !== 'none' && !t.date) t.date = U.todayKey();
    t.reminder = reminder(t.reminder);
    t.category = catId(t.category);
    t.done = !!t.done;
    t.completedAt = num(t.completedAt, null);
    t.doneDates = dateMap(t.doneDates);
    t.subtasks = arr(t.subtasks).filter(isObj).map((x) => ({ id: id(x.id), title: str(x.title, 200), done: !!x.done }));
    t.goalId = typeof t.goalId === 'string' && RE_ID.test(t.goalId) ? t.goalId : null;
    return t;
  }

  function cleanEvent(raw) {
    const e = newEvent(isObj(raw) ? raw : {});
    e.id = id(e.id);
    e.title = str(e.title, 200);
    e.notes = str(e.notes);
    e.location = str(e.location, 200);
    e.date = date(e.date, U.todayKey());
    e.start = time(e.start, '09:00');
    e.end = time(e.end, U.fromMin(U.toMin(e.start) + 60));
    e.allDay = !!e.allDay;
    e.repeat = oneOf(e.repeat, REPEAT_KEYS, 'none');
    e.reminder = reminder(e.reminder);
    e.category = catId(e.category);
    return e;
  }

  function cleanHabit(raw) {
    const h = newHabit(isObj(raw) ? raw : {});
    h.id = id(h.id);
    h.name = str(h.name, 80);
    h.icon = str(h.icon, 8) || '⭐';
    h.color = color(h.color, '#6366f1');
    h.log = dateMap(h.log);
    return h;
  }

  function cleanGoal(raw) {
    const g = newGoal(isObj(raw) ? raw : {});
    g.id = id(g.id);
    g.title = str(g.title, 120);
    g.notes = str(g.notes);
    g.year = int(g.year, 2000, 2100, new Date().getFullYear());
    g.startMonth = int(g.startMonth, 0, 11, 0);
    g.endMonth = int(g.endMonth, 0, 11, 11);
    if (g.endMonth < g.startMonth) [g.startMonth, g.endMonth] = [g.endMonth, g.startMonth];
    g.progress = int(g.progress, 0, 100, 0);
    g.target = num(g.target, 0) > 0 ? num(g.target, 0) : null;
    g.category = catId(g.category);
    g.milestones = arr(g.milestones).filter(isObj).map((m) => ({
      id: id(m.id), title: str(m.title, 200), date: date(m.date, `${g.year}-12-15`), done: !!m.done, doneAt: num(m.doneAt, null),
    }));
    g.savings = arr(g.savings).filter(isObj).map((x) => ({ id: id(x.id), amount: num(x.amount, 0), date: date(x.date, U.todayKey()) }))
      .filter((x) => x.amount > 0);
    return g;
  }

  function cleanMoney(m) {
    m = isObj(m) ? m : {};
    const RE_MONTH = /^\d{4}-\d{2}$/;
    const thisMonth = U.todayKey().slice(0, 7);
    const paid = (v) => {
      const out = {};
      if (isObj(v)) Object.keys(v).forEach((k) => { if (RE_MONTH.test(k) && typeof v[k] === 'string' && RE_ID.test(v[k])) out[k] = v[k]; });
      return out;
    };
    return {
      budget: num(m.budget, 0) > 0 ? num(m.budget, 0) : null,
      entries: arr(m.entries).filter(isObj).map((e) => ({
        id: id(e.id), type: oneOf(e.type, ['out', 'in'], 'out'), amount: Math.abs(num(e.amount, 0)),
        cat: typeof e.cat === 'string' && RE_ID.test(e.cat) ? e.cat : 'other', date: date(e.date, U.todayKey()),
        note: str(e.note, 120), billId: typeof e.billId === 'string' && RE_ID.test(e.billId) ? e.billId : null,
        createdAt: num(e.createdAt, Date.now()),
      })).filter((e) => e.amount > 0),
      bills: arr(m.bills).filter(isObj).map((b) => ({
        id: id(b.id), name: str(b.name, 80), amount: Math.abs(num(b.amount, 0)),
        cat: typeof b.cat === 'string' && RE_ID.test(b.cat) ? b.cat : 'bills', day: int(b.day, 1, 31, 1),
        start: typeof b.start === 'string' && RE_MONTH.test(b.start) ? b.start : thisMonth,
        active: b.active !== false, paid: paid(b.paid), createdAt: num(b.createdAt, Date.now()),
      })),
    };
  }

  function cleanSettings(s, base) {
    s = isObj(s) ? s : {};
    return {
      name: str(s.name, 40),
      theme: oneOf(s.theme, ['system', 'light', 'dark'], base.theme),
      weekStart: oneOf(num(s.weekStart, base.weekStart), [0, 1, 6], base.weekStart),
      clock: oneOf(String(s.clock), ['12', '24'], base.clock),
      notifications: !!s.notifications,
      sound: s.sound === undefined ? base.sound : !!s.sound,
      defaultReminder: int(s.defaultReminder, 0, 10080, base.defaultReminder),
      showHabits: !!s.showHabits,
      currency: str(s.currency, 6),
      lang: oneOf(s.lang, ['ckb', 'en'], base.lang),
    };
  }

  function normalize(data) {
    const base = defaults();
    const src = isObj(data) ? data : {};
    const out = base;
    out.settings = cleanSettings(src.settings, base.settings);
    out.meta = { ...base.meta, ...(isObj(src.meta) ? src.meta : {}) };
    ['createdAt', 'lastBackup', 'backupSnooze'].forEach((k) => { out.meta[k] = num(out.meta[k], k === 'createdAt' ? Date.now() : null); });
    out.meta.installTipDismissed = !!out.meta.installTipDismissed;
    const cats = arr(src.categories).filter(isObj).map((c) => ({ id: id(c.id), name: str(c.name, 24) || 'Other', color: color(c.color, '#94a3b8') }));
    if (cats.length) out.categories = cats;
    ['days', 'years', 'reviews', 'notified'].forEach((k) => { out[k] = isObj(src[k]) ? src[k] : {}; });
    out.tasks = arr(src.tasks).map(cleanTask);
    out.events = arr(src.events).map(cleanEvent);
    out.habits = arr(src.habits).map(cleanHabit);
    out.goals = arr(src.goals).map(cleanGoal);
    out.money = cleanMoney(src.money);
    return out;
  }

  function defaultCategory() {
    return (state && state.categories[0] && state.categories[0].id) || 'personal';
  }

  function newTask(p) {
    return {
      id: U.uid(), title: '', notes: '', date: U.todayKey(), time: null, priority: 'medium',
      category: defaultCategory(), repeat: 'none', reminder: null, done: false, completedAt: null,
      doneDates: {}, subtasks: [], goalId: null, createdAt: Date.now(), ...(p || {}),
    };
  }
  function newEvent(p) {
    return {
      id: U.uid(), title: '', notes: '', location: '', date: U.todayKey(), start: '09:00', end: '10:00',
      allDay: false, category: defaultCategory(), repeat: 'none',
      reminder: state ? state.settings.defaultReminder : 15, createdAt: Date.now(), ...(p || {}),
    };
  }
  function newHabit(p) {
    return { id: U.uid(), name: '', icon: '⭐', color: '#6366f1', log: {}, createdAt: Date.now(), ...(p || {}) };
  }
  function newGoal(p) {
    const now = new Date();
    return {
      id: U.uid(), title: '', notes: '', year: now.getFullYear(), category: defaultCategory(),
      startMonth: now.getMonth(), endMonth: 11, progress: 0, milestones: [], target: null, savings: [],
      createdAt: Date.now(), ...(p || {}),
    };
  }

  function load() {
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      raw = null;
    }
    state = normalize(raw);
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!warnedStorage && App.ui) {
        warnedStorage = true;
        App.ui.toast(App.t('Could not save. Browser storage is full or blocked. Download a backup from Settings.'), { type: 'danger', duration: 8000 });
      }
    }
  }

  function save(opts) {
    persist();
    if (!(opts && opts.silent)) listeners.forEach((fn) => fn(state));
  }

  function find(coll, id) {
    return state[coll].find((x) => x.id === id);
  }

  function upsert(coll, item, opts) {
    item.updatedAt = Date.now();
    const i = state[coll].findIndex((x) => x.id === item.id);
    if (i >= 0) state[coll][i] = item;
    else state[coll].push(item);
    save(opts);
    return item;
  }

  function remove(coll, id) {
    const i = state[coll].findIndex((x) => x.id === id);
    if (i < 0) return null;
    const [item] = state[coll].splice(i, 1);
    save();
    return { item, index: i };
  }

  function restore(coll, item, index) {
    state[coll].splice(Math.min(index, state[coll].length), 0, item);
    save();
  }

  function category(id) {
    return state.categories.find((c) => c.id === id) || FALLBACK_CATEGORY;
  }

  function day(key) {
    if (!state.days[key]) state.days[key] = { focus: '', notes: '', mood: null };
    return state.days[key];
  }

  function replaceAll(data) {
    state = normalize(data);
    save();
  }

  function reset() {
    const keep = state.settings;
    state = defaults();
    state.settings = { ...state.settings, ...keep };
    save();
  }

  App.store = {
    get state() { return state; },
    KEY,
    load, save, on: (fn) => listeners.add(fn), find, upsert, remove, restore, category, day,
    replaceAll, reset, normalize,
    newTask, newEvent, newHabit, newGoal, defaultCategory,
  };
})();
