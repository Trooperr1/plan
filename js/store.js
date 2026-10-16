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
      notified: {}, // reminders already shown
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
      },
    };
  }

  function normalize(data) {
    const base = defaults();
    const src = data && typeof data === 'object' ? data : {};
    const out = { ...base, ...src };
    out.settings = { ...base.settings, ...(src.settings || {}) };
    out.meta = { ...base.meta, ...(src.meta && typeof src.meta === 'object' ? src.meta : {}) };
    ['tasks', 'events', 'habits', 'goals', 'categories'].forEach((k) => {
      if (!Array.isArray(out[k])) out[k] = base[k];
    });
    ['days', 'years', 'notified'].forEach((k) => {
      if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
    });
    out.tasks = out.tasks.map((t) => newTask(t));
    out.events = out.events.map((e) => newEvent(e));
    out.habits = out.habits.map((h) => newHabit(h));
    out.goals = out.goals.map((g) => newGoal(g));
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
        App.ui.toast('Could not save — browser storage is full or blocked. Export a backup from Settings.', { type: 'danger', duration: 8000 });
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
