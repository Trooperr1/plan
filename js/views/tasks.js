/* Tasks — every to-do with filters, search and grouping. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);

  const view = { title: 'Tasks', filter: 'today', q: '' };

  const FILTERS = [
    ['today', 'Today', 'sun'],
    ['upcoming', 'Upcoming', 'calendar'],
    ['all', 'All', 'list'],
    ['completed', 'Done', 'check'],
  ];

  function matches(t) {
    if (view.q) {
      const q = view.q.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !(t.notes || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }

  /* Returns [{label, key, tasks}] groups for the active filter. */
  function groups(filter) {
    const st = App.store.state;
    const today = U.todayKey();
    const out = [];
    const push = (label, key, tasks, opts) => {
      tasks = tasks.filter(matches);
      if (tasks.length) out.push({ label, key, tasks, ...(opts || {}) });
    };
    switch (filter) {
      case 'today':
        push('Overdue', null, S.overdue(today), { danger: true, showDate: true });
        push('Today', today, S.tasksOn(today));
        break;
      case 'upcoming':
        for (let i = 1; i <= 14; i++) {
          const k = U.addDays(today, i);
          push(U.relDay(k), k, S.tasksOn(k));
        }
        break;
      case 'completed':
        push('Completed', null, st.tasks.filter((t) => !S.isRecurring(t) && t.done)
          .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)), { showDate: true });
        break;
      default: {
        push('Repeating', today, st.tasks.filter((t) => S.isRecurring(t)).sort(S.byTimeThenPrio), { showDate: false });
        const dated = st.tasks.filter((t) => !S.isRecurring(t) && t.date).sort((a, b) => a.date.localeCompare(b.date) || S.byTimeThenPrio(a, b));
        push('Scheduled', null, dated.filter((t) => !t.done), { showDate: true });
        push('No date', today, st.tasks.filter((t) => !t.date && !t.done));
        push('Done', null, dated.filter((t) => t.done), { showDate: true });
      }
    }
    return out;
  }

  function count(filter) {
    return groups(filter).reduce((n, g) => n + g.tasks.length, 0);
  }

  view.render = function () {
    const gs = groups(view.filter);
    const total = gs.reduce((n, g) => n + g.tasks.length, 0);
    const filtered = !!view.q;

    const body = gs.length
      ? gs.map((g) => `
        <div class="group-label ${g.danger ? 'danger' : ''}">${U.esc(g.label)} <span>${g.tasks.length}</span></div>
        <div class="task-list">${g.tasks.map((t) => C.taskItem(t, g.key || t.date || U.todayKey(), { showDate: g.showDate, showSubs: true })).join('')}</div>`).join('')
      : C.empty(filtered ? 'search' : 'check', filtered ? 'No matching tasks' : 'No tasks',
        filtered ? 'Try a different word.' : 'Nothing here.',
        `<button type="button" class="btn ghost sm" data-action="new-task">${icon('plus', 14)}New task</button>`);

    return `
      <div class="tasks-page">
        <div class="tabs" role="tablist">
          ${FILTERS.map(([id, label, ic]) => {
            const n = id === 'all' || id === 'completed' ? '' : count(id);
            return `<button type="button" class="tab ${view.filter === id ? 'on' : ''}" data-action="filter" data-filter="${id}" role="tab" aria-selected="${view.filter === id}">
              ${icon(ic, 15)}<span>${label}</span>${n ? `<em>${n}</em>` : ''}</button>`;
          }).join('')}
        </div>

        <div class="filters">
          <label class="search">${icon('search', 16)}<input type="search" id="taskSearch" placeholder="Search tasks…" value="${U.esc(view.q)}" aria-label="Search tasks"></label>
          ${view.filter === 'completed' && total ? `<button type="button" class="btn ghost sm danger-text" data-action="clear-completed">${icon('trash', 14)}Clear completed</button>` : ''}
        </div>

        <section class="card">${body}</section>
      </div>`;
  };

  view.onClick = async function (e, a) {
    if (!a) return;
    if (a.dataset.action === 'filter') {
      view.filter = a.dataset.filter;
      App.render();
    } else if (a.dataset.action === 'clear-completed') {
      const st = App.store.state;
      const n = st.tasks.filter((t) => !S.isRecurring(t) && t.done).length;
      if (await App.ui.confirm(`Delete ${n} completed task${n === 1 ? '' : 's'}? This cannot be undone.`, { okText: 'Delete all' })) {
        st.tasks = st.tasks.filter((t) => S.isRecurring(t) || !t.done);
        App.store.save();
        App.ui.toast('Completed tasks cleared');
      }
    }
  };

  view.onInput = function (e) {
    if (e.target.id === 'taskSearch') {
      view.q = e.target.value.trim();
      App.render();
    }
  };

  App.views.tasks = view;
})();
