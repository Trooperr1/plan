/* App bootstrap: routing, navigation, shared actions, theme, shortcuts and service worker. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const icon = (n, s) => App.icon(n, s);

  const NAV = [
    ['today', 'My Day', 'sun'],
    ['calendar', 'Calendar', 'calendar'],
    ['tasks', 'Tasks', 'list'],
    ['habits', 'Habits', 'flame'],
    ['timeline', 'Year Timeline', 'flag'],
    ['settings', 'Settings', 'sliders'],
  ];
  const SHORT = { timeline: 'Year', today: 'Today' };
  let current = null;
  const viewEl = document.getElementById('view');

  function routeFromHash() {
    const r = location.hash.replace(/^#\/?/, '').split('/')[0];
    return App.views[r] ? r : 'today';
  }

  /* ---------- Shared actions (used from any page) ---------- */
  App.actions = {
    async deleteTask(id) {
      const t = App.store.find('tasks', id);
      if (!t) return;
      const msg = S.isRecurring(t) ? `Delete the repeating task “${t.title}” and all its future days?` : `Delete “${t.title}”?`;
      if (!(await App.ui.confirm(msg))) return;
      const r = App.store.remove('tasks', id);
      App.ui.toast('Task deleted', { icon: 'trash', action: { label: 'Undo', fn: () => App.store.restore('tasks', r.item, r.index) } });
    },
    async deleteEvent(id) {
      const ev = App.store.find('events', id);
      if (!ev) return;
      if (!(await App.ui.confirm(`Delete the event “${ev.title}”${S.isRecurring(ev) ? ' and all its repeats' : ''}?`))) return;
      const r = App.store.remove('events', id);
      App.ui.toast('Event deleted', { icon: 'trash', action: { label: 'Undo', fn: () => App.store.restore('events', r.item, r.index) } });
    },
    async deleteHabit(id) {
      const h = App.store.find('habits', id);
      if (!h) return;
      if (!(await App.ui.confirm(`Delete the habit “${h.name}” and its history?`))) return;
      const r = App.store.remove('habits', id);
      App.ui.toast('Habit deleted', { icon: 'trash', action: { label: 'Undo', fn: () => App.store.restore('habits', r.item, r.index) } });
    },
    async deleteGoal(id) {
      const g = App.store.find('goals', id);
      if (!g) return;
      if (!(await App.ui.confirm(`Delete the goal “${g.title}” and its milestones?`))) return;
      const r = App.store.remove('goals', id);
      App.ui.toast('Goal deleted', { icon: 'trash', action: { label: 'Undo', fn: () => App.store.restore('goals', r.item, r.index) } });
    },
  };

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
        if (s.total > 1 && s.done === s.total) App.ui.toast(`All ${s.total} tasks done for ${U.relDay(key).toLowerCase()}! 🎉`, { icon: 'trophy' });
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
    'new-task'(a) { App.forms.task(null, a.dataset.date ? { date: a.dataset.date } : {}); },
    'edit-event'(a) { const e = App.store.find('events', a.dataset.id); if (e) App.forms.event(e); },
    'new-event'(a) { App.forms.event(null, a.dataset.date ? { date: a.dataset.date } : {}); },
    'toggle-habit'(a) {
      const h = App.store.find('habits', a.dataset.id);
      if (!h) return;
      const key = a.dataset.date || U.todayKey();
      if (key > U.todayKey()) return App.ui.toast('You can only check in for today or earlier.', { icon: 'clock' });
      S.toggleHabit(h, key);
      App.store.save();
      const streak = S.streak(h);
      if (S.habitDone(h, key) && key === U.todayKey() && streak > 1 && streak % 7 === 0) App.ui.toast(`${streak}-day streak on “${h.name}”! 🔥`, { icon: 'trophy' });
    },
    'new-habit'() { App.forms.habit(); },
    'edit-habit'(a) { const h = App.store.find('habits', a.dataset.id); if (h) App.forms.habit(h); },
    'new-goal'() { /* handled by the timeline view (needs its year) */ return false; },
    'edit-goal'(a) { const g = App.store.find('goals', a.dataset.id); if (g) App.forms.goal(g); },
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
    const nav = NAV.map(([id, label, ic], i) => `
      <a href="#/${id}" class="nav-link ${current === id ? 'on' : ''}" ${current === id ? 'aria-current="page"' : ''} title="${label} (${i + 1})">
        ${icon(ic, 19)}<span>${label}</span>${id === 'tasks' ? badge() : ''}</a>`).join('');
    document.getElementById('nav').innerHTML = nav;
    document.getElementById('bottomNav').innerHTML = NAV.map(([id, label, ic]) => `
      <a href="#/${id}" class="bn-link ${current === id ? 'on' : ''}" ${current === id ? 'aria-current="page"' : ''}>${icon(ic, 21)}<span>${SHORT[id] || label}</span></a>`).join('');

    const y = new Date().getFullYear();
    const pct = (U.dayOfYear(U.todayKey()) / U.daysInYear(y)) * 100;
    const today = S.dayStats(U.todayKey());
    document.getElementById('sidebarFoot').innerHTML = `
      <div class="mini-stat"><span>Today</span><strong>${today.done}/${today.total} tasks</strong></div>
      <div class="bar"><div style="width:${today.total ? (today.done / today.total) * 100 : 0}%"></div></div>
      <div class="mini-stat"><span>${y}</span><strong>${pct.toFixed(0)}% passed</strong></div>
      <div class="bar year"><div style="width:${pct}%"></div></div>
      ${st.settings.name ? `<p class="muted sm">Keep going, ${U.esc(st.settings.name)} 💪</p>` : ''}`;
  }

  function badge() {
    const n = S.overdue(U.todayKey()).length;
    return n ? `<em class="badge" title="${n} overdue">${n}</em>` : '';
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
    document.getElementById('pageTitle').textContent = view.title;
    document.title = `${view.title} · Daily Planner`;
    renderChrome();
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
  function tick() {
    const now = new Date();
    document.getElementById('clock').textContent = `${now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${U.fmtTime(`${U.pad(now.getHours())}:${U.pad(now.getMinutes())}`)}`;
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
    else if (/^[1-6]$/.test(k)) location.hash = `#/${NAV[Number(k) - 1][0]}`;
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
  applyTheme();
  App.store.on(() => render());
  navigate();
  tick();
  setInterval(tick, 5000);
  App.reminders.start();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  }
})();
