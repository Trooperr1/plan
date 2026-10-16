/* Persistent app state (saved in this browser's localStorage) with simple change notifications. */
(function () {
  const App = window.App;
  const U = App.util;
  const KEY = 'dailyPlanner.data.v1';
  const listeners = new Set();
  let state = null;
  let warnedStorage = false;

  const DEFAULT_CATEGORIES = [
    { id: 'personal', name: 'Personal', color: '#6366f1' },
    { id: 'work', name: 'Work', color: '#0ea5e9' },
    { id: 'health', name: 'Health', color: '#22c55e' },
    { id: 'study', name: 'Study', color: '#f59e0b' },
    { id: 'finance', name: 'Finance', color: '#ec4899' },
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
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      settings: {
        name: '',
        theme: 'system',
        weekStart: 1,
        clock: '12',
        notifications: false,
        sound: true,
        defaultReminder: 15,
      },
    };
  }

  function normalize(data) {
    const base = defaults();
    const src = data && typeof data === 'object' ? data : {};
    const out = { ...base, ...src };
    out.settings = { ...base.settings, ...(src.settings || {}) };
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
      doneDates: {}, subtasks: [], createdAt: Date.now(), ...(p || {}),
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
      startMonth: now.getMonth(), endMonth: 11, progress: 0, milestones: [], createdAt: Date.now(), ...(p || {}),
    };
  }

  function sampleData() {
    const t = U.todayKey();
    const tm = U.addDays(t, 1);
    const y = new Date().getFullYear();
    const sub = (title, done) => ({ id: U.uid(), title, done });
    const ms = (title, date, done) => ({ id: U.uid(), title, date, done });

    const habits = [
      newHabit({ name: 'Exercise 30 min', icon: '🏃', color: '#22c55e' }),
      newHabit({ name: 'Read 20 pages', icon: '📚', color: '#f59e0b' }),
      newHabit({ name: 'Drink 8 glasses of water', icon: '💧', color: '#0ea5e9' }),
      newHabit({ name: 'Sleep before 11 PM', icon: '😴', color: '#8b5cf6' }),
    ];
    habits.forEach((h, hi) => {
      for (let i = 1; i <= 60; i++) {
        if ((i * 7 + hi * 3) % 5 !== 0 && (i + hi) % 11 !== 0) h.log[U.addDays(t, -i)] = true;
      }
    });

    return {
      tasks: [
        newTask({ title: 'Plan my day', notes: 'Check the calendar and choose my top 3 priorities.', date: t, time: '08:00', category: 'personal', repeat: 'daily', reminder: 5 }),
        newTask({ title: 'Finish project report', date: t, time: '14:00', priority: 'high', category: 'work', reminder: 15,
          subtasks: [sub('Collect the data', true), sub('Write the summary', false), sub('Send to manager', false)] }),
        newTask({ title: 'Read 20 pages', date: t, time: '21:00', priority: 'low', category: 'study', repeat: 'daily', reminder: 10 }),
        newTask({ title: 'Weekly review & plan next week', date: t, time: '18:00', category: 'personal', repeat: 'weekly', reminder: 30 }),
        newTask({ title: 'Pay electricity bill', date: tm, priority: 'high', category: 'finance' }),
        newTask({ title: 'Call the bank about card', date: U.addDays(t, -1), priority: 'medium', category: 'finance' }),
        newTask({ title: 'Buy a new notebook', date: null, priority: 'low', category: 'personal' }),
      ],
      events: [
        newEvent({ title: 'Morning walk', date: t, start: '06:30', end: '07:15', category: 'health', repeat: 'daily', reminder: 10, location: 'Park' }),
        newEvent({ title: 'Team meeting', date: t, start: '11:00', end: '12:00', category: 'work', repeat: 'weekdays', reminder: 15, location: 'Office / Zoom' }),
        newEvent({ title: 'Lunch break', date: t, start: '13:00', end: '13:45', category: 'personal', repeat: 'daily', reminder: null }),
        newEvent({ title: 'Gym session', date: tm, start: '17:30', end: '18:30', category: 'health', reminder: 30 }),
      ],
      habits,
      goals: [
        newGoal({ title: 'Get fit & healthy', year: y, category: 'health', startMonth: 0, endMonth: 11, progress: 65,
          notes: 'Workout 4x a week, eat clean, sleep 7+ hours.',
          milestones: [ms('Run 5 km', `${y}-03-15`, true), ms('Lose 5 kg', `${y}-07-01`, true), ms('Run 10 km', `${y}-11-20`, false)] }),
        newGoal({ title: 'Learn a new skill', year: y, category: 'study', startMonth: 2, endMonth: 8, progress: 80,
          milestones: [ms('Finish online course', `${y}-05-30`, true), ms('Build first project', `${y}-08-25`, false)] }),
        newGoal({ title: 'Save an emergency fund', year: y, category: 'finance', startMonth: 0, endMonth: 11, progress: 50,
          milestones: [ms('Save 25%', `${y}-03-31`, true), ms('Save 50%', `${y}-06-30`, true), ms('Save 100%', `${y}-12-31`, false)] }),
        newGoal({ title: 'Grow in my career', year: y, category: 'work', startMonth: 5, endMonth: 11, progress: 35,
          milestones: [ms('Get certification', `${y}-09-15`, false), ms('Lead a project', `${y}-12-10`, false)] }),
      ],
      years: { [y]: { theme: 'Discipline & growth' } },
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
    if (!raw) {
      Object.assign(state, sampleData());
      persist();
    }
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

  function addSamples() {
    const s = sampleData();
    ['tasks', 'events', 'habits', 'goals'].forEach((k) => state[k].push(...s[k]));
    save();
  }

  App.store = {
    get state() { return state; },
    KEY,
    load, save, on: (fn) => listeners.add(fn), find, upsert, remove, restore, category, day,
    replaceAll, reset, addSamples, normalize,
    newTask, newEvent, newHabit, newGoal, defaultCategory,
  };
})();
