/* Recurrence, completion and stats logic for tasks, events and habits. */
(function () {
  const App = window.App;
  const U = App.util;
  const st = () => App.store.state;

  const REPEATS = {
    none: 'Does not repeat',
    daily: 'Every day',
    weekdays: 'Every weekday (Mon–Fri)',
    weekly: 'Every week',
    monthly: 'Every month',
    yearly: 'Every year',
  };
  const REPEAT_SHORT = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  const REMINDERS = [
    [null, 'No reminder'], [0, 'At start time'], [5, '5 minutes before'], [10, '10 minutes before'],
    [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before'],
  ];
  const PRIORITIES = { high: 'High', medium: 'Medium', low: 'Low' };
  const PRIO_ORDER = { high: 0, medium: 1, low: 2 };

  function isRecurring(item) {
    return !!item.repeat && item.repeat !== 'none';
  }

  function occursOn(item, key) {
    if (!item.date || key < item.date) return false;
    switch (item.repeat || 'none') {
      case 'none': return key === item.date;
      case 'daily': return true;
      case 'weekdays': { const w = U.weekday(key); return w > 0 && w < 6; }
      case 'weekly': return U.weekday(key) === U.weekday(item.date);
      case 'monthly': return key.slice(8) === item.date.slice(8);
      case 'yearly': return key.slice(5) === item.date.slice(5);
      default: return key === item.date;
    }
  }

  function isDone(t, key) {
    return isRecurring(t) ? !!(t.doneDates && t.doneDates[key]) : !!t.done;
  }

  function setDone(t, key, val) {
    if (isRecurring(t)) {
      t.doneDates = t.doneDates || {};
      if (val) t.doneDates[key] = true;
      else delete t.doneDates[key];
    } else {
      t.done = val;
      t.completedAt = val ? Date.now() : null;
    }
  }

  function byTimeThenPrio(a, b) {
    const ta = a.time || '99:99';
    const tb = b.time || '99:99';
    if (ta !== tb) return ta.localeCompare(tb);
    return (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1);
  }

  function tasksOn(key) {
    return st().tasks.filter((t) => occursOn(t, key)).sort(byTimeThenPrio);
  }

  function eventsOn(key) {
    return st().events.filter((e) => occursOn(e, key)).sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.start || '').localeCompare(b.start || '');
    });
  }

  function overdue(today) {
    return st().tasks
      .filter((t) => !isRecurring(t) && t.date && t.date < today && !t.done)
      .sort((a, b) => a.date.localeCompare(b.date) || byTimeThenPrio(a, b));
  }

  /* Time-ordered schedule for a day: events plus tasks that have a time. */
  function agenda(key) {
    const items = [];
    eventsOn(key).forEach((e) => items.push({ kind: 'event', item: e, start: e.allDay ? null : e.start, end: e.allDay ? null : e.end }));
    tasksOn(key).filter((t) => t.time).forEach((t) => items.push({ kind: 'task', item: t, start: t.time, end: null }));
    return items.sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00') || (a.start ? 1 : -1) - (b.start ? 1 : -1));
  }

  function dayStats(key) {
    const ts = tasksOn(key);
    return { total: ts.length, done: ts.filter((t) => isDone(t, key)).length };
  }

  function habitDone(h, key) {
    return !!(h.log && h.log[key]);
  }

  function toggleHabit(h, key) {
    h.log = h.log || {};
    if (h.log[key]) delete h.log[key];
    else h.log[key] = true;
  }

  function streak(h) {
    let k = U.todayKey();
    if (!habitDone(h, k)) k = U.addDays(k, -1);
    let n = 0;
    while (habitDone(h, k)) {
      n++;
      k = U.addDays(k, -1);
    }
    return n;
  }

  function bestStreak(h) {
    const keys = Object.keys(h.log || {}).filter((k) => h.log[k]).sort();
    let best = 0;
    let cur = 0;
    let prev = null;
    for (const k of keys) {
      cur = prev && U.addDays(prev, 1) === k ? cur + 1 : 1;
      best = Math.max(best, cur);
      prev = k;
    }
    return best;
  }

  function habitRate(h, days) {
    const today = U.todayKey();
    let done = 0;
    for (let i = 0; i < days; i++) if (habitDone(h, U.addDays(today, -i))) done++;
    return Math.round((done / days) * 100);
  }

  App.sched = {
    REPEATS, REPEAT_SHORT, REMINDERS, PRIORITIES,
    isRecurring, occursOn, isDone, setDone, tasksOn, eventsOn, overdue, agenda, dayStats,
    habitDone, toggleHabit, streak, bestStreak, habitRate, byTimeThenPrio,
  };
})();
