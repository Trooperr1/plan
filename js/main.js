/* App bootstrap: routing, navigation, shared actions, theme, shortcuts and service worker. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);

  const ALL_NAV = [
    ['today', 'My Day', 'sun'],
    ['calendar', 'Calendar', 'calendar'],
    ['tasks', 'Tasks', 'list'],
    ['goals', 'Goals', 'flag'],
    ['money', 'Money', 'wallet'],
    ['habits', 'Habits', 'flame'],
    ['settings', 'Settings', 'sliders'],
  ];
  const SHORT = { today: 'Today' };
  // Habits is an optional page (Settings → Extra pages).
  const nav = () => ALL_NAV.filter(([id]) => id !== 'habits' || App.store.state.settings.showHabits);
  let current = null;
  const viewEl = document.getElementById('view');

  const HIDDEN = ['review']; // pages reached from buttons, not the menu
  function routeFromHash() {
    const r = location.hash.replace(/^#\/?/, '').split('/')[0];
    return nav().some(([id]) => id === r) || HIDDEN.includes(r) ? r : 'today';
  }

  /* ---------- Shared actions (used from any page) ---------- */
  App.actions = {
    async deleteTask(id) {
      const t = App.store.find('tasks', id);
      if (!t) return;
      const msg = S.isRecurring(t) ? T('Delete the repeating task “{name}” and all its days?', { name: t.title }) : T('Delete “{name}”?', { name: t.title });
      if (!(await App.ui.confirm(msg))) return;
      const r = App.store.remove('tasks', id);
      App.ui.toast(T('Task deleted'), { icon: 'trash', action: { label: T('Undo'), fn: () => App.store.restore('tasks', r.item, r.index) } });
    },
    async deleteEvent(id) {
      const ev = App.store.find('events', id);
      if (!ev) return;
      if (!(await App.ui.confirm(T('Delete “{name}”?', { name: ev.title })))) return;
      const r = App.store.remove('events', id);
      App.ui.toast(T('Event deleted'), { icon: 'trash', action: { label: T('Undo'), fn: () => App.store.restore('events', r.item, r.index) } });
    },
    async deleteHabit(id) {
      const h = App.store.find('habits', id);
      if (!h) return;
      if (!(await App.ui.confirm(T('Delete “{name}”?', { name: h.name })))) return;
      const r = App.store.remove('habits', id);
      App.ui.toast(T('Habit deleted'), { icon: 'trash', action: { label: T('Undo'), fn: () => App.store.restore('habits', r.item, r.index) } });
    },
    async deleteGoal(id) {
      const g = App.store.find('goals', id);
      if (!g) return;
      if (!(await App.ui.confirm(T('Delete the goal “{name}” and its steps?', { name: g.title })))) return;
      const r = App.store.remove('goals', id);
      App.ui.toast(T('Goal deleted'), { icon: 'trash', action: { label: T('Undo'), fn: () => App.store.restore('goals', r.item, r.index) } });
    },
    async deleteEntry(id) {
      const money = App.store.state.money;
      const i = money.entries.findIndex((x) => x.id === id);
      if (i < 0) return;
      if (!(await App.ui.confirm(T('Delete this payment?')))) return;
      const [item] = money.entries.splice(i, 1);
      App.store.save();
      App.ui.toast(T('Payment deleted'), { icon: 'trash', action: { label: T('Undo'), fn: () => { money.entries.splice(i, 0, item); App.store.save(); } } });
    },
    async deleteBill(id) {
      const money = App.store.state.money;
      const i = money.bills.findIndex((x) => x.id === id);
      if (i < 0) return;
      if (!(await App.ui.confirm(T('Delete the bill “{name}”? Payments you already made stay in your history.', { name: money.bills[i].name })))) return;
      const [item] = money.bills.splice(i, 1);
      App.store.save();
      App.ui.toast(T('Bill deleted'), { icon: 'trash', action: { label: T('Undo'), fn: () => { money.bills.splice(i, 0, item); App.store.save(); } } });
    },
  };

  function moveTasks(list, toKey, label) {
    if (!list.length) return;
    const before = list.map((t) => [t, t.date]);
    list.forEach((t) => { t.date = toKey; });
    App.store.save();
    App.ui.toast(T(label === 'today' ? 'Moved {n} tasks to today' : label === 'tomorrow' ? 'Moved {n} tasks to tomorrow' : 'Moved {n} tasks to next week', { n: list.length }), {
      icon: 'right',
      action: { label: T('Undo'), fn: () => { before.forEach(([t, d]) => { t.date = d; }); App.store.save(); } },
    });
  }

  const shared = {
    'toggle-task'(a) {
      const t = App.store.find('tasks', a.dataset.id);
      if (!t) return;
      const key = a.dataset.date || U.todayKey();
      const val = !S.isDone(t, key);
      S.setDone(t, key, val);
      App.store.save();
      if (val) {
        const s = S.dayStats(key);
        if (s.total > 1 && s.done === s.total) App.ui.toast(T('All {n} tasks done! 🎉', { n: s.total }), { icon: 'trophy' });
      }
    },
    'toggle-sub'(a) {
      const t = App.store.find('tasks', a.dataset.id);
      const s = t && t.subtasks.find((x) => x.id === a.dataset.sub);
      if (!s) return;
      s.done = !s.done;
      App.store.save();
    },
    'edit-task'(a) { const t = App.store.find('tasks', a.dataset.id); if (t) App.forms.task(t); },
    'delete-task'(a) { App.actions.deleteTask(a.dataset.id); },
    'new-task'(a) {
      const preset = {};
      if (a.dataset.date) preset.date = a.dataset.date;
      if (a.dataset.goal) preset.goalId = a.dataset.goal;
      App.forms.task(null, preset);
    },
    'edit-event'(a) { const e = App.store.find('events', a.dataset.id); if (e) App.forms.event(e); },
    'new-event'(a) { App.forms.event(null, a.dataset.date ? { date: a.dataset.date } : {}); },
    'toggle-habit'(a) {
      const h = App.store.find('habits', a.dataset.id);
      if (!h) return;
      const key = a.dataset.date || U.todayKey();
      if (key > U.todayKey()) return App.ui.toast(T('You can only check in for today or earlier.'), { icon: 'clock' });
      S.toggleHabit(h, key);
      App.store.save();
      const streak = S.streak(h);
      if (S.habitDone(h, key) && key === U.todayKey() && streak > 1 && streak % 7 === 0) App.ui.toast(T('{n}-day streak on “{name}”! 🔥', { n: streak, name: h.name }), { icon: 'trophy' });
    },
    'new-habit'() { App.forms.habit(); },
    'edit-habit'(a) { const h = App.store.find('habits', a.dataset.id); if (h) App.forms.habit(h); },
    'new-goal'() { /* handled by the goals view (needs its year) */ return false; },
    'edit-goal'(a) { const g = App.store.find('goals', a.dataset.id); if (g) App.forms.goal(g); },
    'goal-money'(a) { App.forms.money(a.dataset.id); },
    'goal-ics'(a) { const g = App.store.find('goals', a.dataset.id); if (g) App.ics.goal(g); },
    'open-goal'(a) {
      App.views.goals.showYear(Number(a.dataset.year));
      location.hash = '#/goals';
    },
    'move-tomorrow'(a) {
      const key = a.dataset.date;
      const moved = S.tasksOn(key).filter((t) => !S.isRecurring(t) && !t.done);
      moveTasks(moved, U.addDays(key, 1), 'tomorrow');
    },
    'move-overdue'() {
      moveTasks(S.overdue(U.todayKey()), U.todayKey(), 'today');
    },
    'dismiss-evening'(a) {
      App.store.day(a.dataset.date).eveningDismissed = true;
      App.store.save();
    },
    'backup-now'() { App.safety.backup(); },
    'backup-later'() { App.safety.snoozeBackup(); },
    async 'install-app'() {
      if (await App.safety.install()) App.ui.toast(T('App installed'));
      render();
    },
    'dismiss-install'() {
      App.store.state.meta.installTipDismissed = true;
      App.store.save();
    },
    'review-move'(a) {
      const { start, end } = a.dataset;
      const today = U.todayKey();
      const list = App.store.state.tasks.filter((t) => !S.isRecurring(t) && !t.done && t.date && t.date >= start && t.date <= end && t.date <= today);
      const next = U.addDays(end, 1);
      moveTasks(list, next >= today ? next : today, next >= today ? 'next week' : 'today');
    },
    'open-review'() { location.hash = '#/review'; },
    'pay-bill'(a) { App.money.pay(a.dataset.id, a.dataset.month); },
    'review-later'() {
      const r = App.views.review.record(U.todayKey(), true);
      r.later = true;
      App.store.save();
    },
    'open-day'(a, e) {
      e.preventDefault();
      App.views.today.date = a.dataset.date === U.todayKey() ? null : a.dataset.date;
      if (current === 'today') render({ fresh: true });
      else location.hash = '#/today';
    },
  };

  /* ---------- Rendering ---------- */
  function renderChrome() {
    const st = App.store.state;
    const items = nav();
    const links = items.map(([id, label, ic], i) => `
      <a href="#/${id}" class="nav-link ${current === id ? 'on' : ''}" ${current === id ? 'aria-current="page"' : ''} title="${T(label)} (${i + 1})">
        ${icon(ic, 19)}<span>${T(label)}</span>${id === 'tasks' ? badge() : ''}</a>`).join('');
    document.getElementById('nav').innerHTML = links;
    const bottom = document.getElementById('bottomNav');
    bottom.style.gridTemplateColumns = `repeat(${items.length}, 1fr)`;
    bottom.innerHTML = items.map(([id, label, ic]) => `
      <a href="#/${id}" class="bn-link ${current === id ? 'on' : ''}" ${current === id ? 'aria-current="page"' : ''}>${icon(ic, 21)}<span>${T(SHORT[id] || label)}</span></a>`).join('');

    const y = new Date().getFullYear();
    const pct = (U.dayOfYear(U.todayKey()) / U.daysInYear(y)) * 100;
    const today = S.dayStats(U.todayKey());
    document.getElementById('sidebarFoot').innerHTML = `
      <div class="mini-stat"><span>${T('Today')}</span><strong>${T('{done}/{total} tasks', { done: today.done, total: today.total })}</strong></div>
      <div class="bar"><div style="width:${today.total ? (today.done / today.total) * 100 : 0}%"></div></div>
      <div class="mini-stat"><span>${y}</span><strong>${T('{pct}% passed', { pct: pct.toFixed(0) })}</strong></div>
      <div class="bar year"><div style="width:${pct}%"></div></div>
      ${st.settings.name ? `<p class="muted sm">${T('Keep going, {name} 💪', { name: U.esc(st.settings.name) })}</p>` : ''}`;
  }

  function badge() {
    const n = S.overdue(U.todayKey()).length;
    return n ? `<em class="badge" title="${T('Overdue')}">${n}</em>` : '';
  }

  function render(opts) {
    opts = opts || {};
    const view = App.views[current];
    const active = document.activeElement;
    let focusId = null;
    let sel = null;
    if (active && active.id && viewEl.contains(active)) {
      focusId = active.id;
      try { sel = [active.selectionStart, active.selectionEnd]; } catch (e) { sel = null; }
    }
    const scrolls = {};
    if (!opts.fresh) viewEl.querySelectorAll('[data-keep-scroll]').forEach((s) => { scrolls[s.id] = [s.scrollTop, s.scrollLeft]; });

    viewEl.innerHTML = view.render();

    viewEl.querySelectorAll('[data-keep-scroll]').forEach((s) => {
      if (scrolls[s.id]) [s.scrollTop, s.scrollLeft] = scrolls[s.id];
    });
    if (view.mounted) view.mounted(viewEl, { fresh: opts.fresh || !Object.keys(scrolls).length });
    if (focusId) {
      const f = document.getElementById(focusId);
      if (f) {
        f.focus({ preventScroll: true });
        try { if (sel && sel[0] != null) f.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text input */ }
      }
    }
    document.getElementById('pageTitle').textContent = T(view.title);
    document.title = `${T(view.title)} · ${T('Daily Planner')}`;
    App.i18n.apply();
    renderChrome();
    updateClock();
  }

  function navigate() {
    current = routeFromHash();
    render({ fresh: true });
    window.scrollTo(0, 0);
  }

  /* ---------- Theme ---------- */
  const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = App.store.state.settings.theme;
    const dark = t === 'dark' || (t === 'system' && darkMq.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0f1219' : '#4f46e5');
  }
  darkMq.addEventListener && darkMq.addEventListener('change', applyTheme);

  /* ---------- Clock & day rollover ---------- */
  let lastMinute = -1;
  let lastDay = U.todayKey();
  function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = `${U.fmtDate(U.todayKey(), { weekday: 'short', month: 'short', day: 'numeric' })} · ${U.fmtTime(`${U.pad(now.getHours())}:${U.pad(now.getMinutes())}`)}`;
  }
  function tick() {
    const now = new Date();
    updateClock();
    if (now.getMinutes() === lastMinute) return;
    lastMinute = now.getMinutes();
    const today = U.todayKey();
    if (today !== lastDay) {
      if (App.views.today.date === lastDay) App.views.today.date = null;
      lastDay = today;
    }
    const typing = document.activeElement && viewEl.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!App.ui.modalOpen && !typing && (current === 'today' || current === 'calendar')) render();
  }

  /* ---------- Events ---------- */
  viewEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    const view = App.views[current];
    if (a && viewEl.contains(a)) {
      const fn = shared[a.dataset.action];
      if (fn && fn(a, e) !== false) return;
    }
    if (view.onClick) view.onClick(e, a && viewEl.contains(a) ? a : null);
  });
  ['input', 'change', 'submit', 'keydown'].forEach((type) => {
    viewEl.addEventListener(type, (e) => {
      const h = App.views[current]['on' + type[0].toUpperCase() + type.slice(1)];
      if (h) h(e);
    });
  });
  // Keyboard activation for role="button" elements.
  viewEl.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-action]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  document.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, 18); });
  document.querySelector('[data-global="new-task"]').addEventListener('click', () => {
    App.forms.task(null, current === 'today' && App.views.today.date ? { date: App.views.today.date } : current === 'calendar' ? { date: App.views.calendar.selected } : {});
  });
  document.querySelector('[data-global="new-event"]').addEventListener('click', () => {
    App.forms.event(null, current === 'today' && App.views.today.date ? { date: App.views.today.date } : current === 'calendar' ? { date: App.views.calendar.selected } : {});
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || App.ui.modalOpen) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); document.querySelector('[data-global="new-task"]').click(); }
    else if (k === 'e') { e.preventDefault(); document.querySelector('[data-global="new-event"]').click(); }
    else if (/^[1-9]$/.test(k) && nav()[Number(k) - 1]) location.hash = `#/${nav()[Number(k) - 1][0]}`;
  });

  window.addEventListener('hashchange', navigate);
  window.addEventListener('storage', (e) => {
    // Keep multiple open tabs in sync.
    if (e.key === App.store.KEY) {
      App.store.load();
      applyTheme();
      render();
    }
  });

  /* ---------- Boot ---------- */
  App.render = render;
  App.renderChrome = renderChrome;
  App.applyTheme = applyTheme;

  App.store.load();
  App.i18n.apply();
  applyTheme();
  App.store.on(() => {
    if (routeFromHash() !== current) location.hash = '#/' + routeFromHash();
    render();
  });
  navigate();
  tick();
  setInterval(tick, 5000);
  App.reminders.start();
  App.safety.protect().then(() => { if (current === 'settings') render(); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  }
})();
