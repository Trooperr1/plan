/* Goals — yearly goals with milestones, shown as cards and on a 12-month roadmap. */
(function () {
  const App = window.App;
  const U = App.util;
  const C = App.c;
  const S = App.sched;
  const icon = (n, s) => App.icon(n, s);

  const view = { title: 'Goals', year: null };

  function yearPos(key, year) {
    if (Number(key.slice(0, 4)) !== year) return null;
    return ((U.dayOfYear(key) - 0.5) / U.daysInYear(year)) * 100;
  }

  /* Years to offer: this year, the next four, and any year that already has goals. */
  function years() {
    const now = new Date().getFullYear();
    const set = new Set([now, now + 1, now + 2, now + 3, now + 4]);
    App.store.state.goals.forEach((g) => set.add(g.year));
    return [...set].sort((a, b) => a - b);
  }

  function yearInfo(year) {
    const now = new Date().getFullYear();
    if (year === now) {
      const day = U.dayOfYear(U.todayKey());
      const total = U.daysInYear(year);
      const pct = (day / total) * 100;
      return `
        <div class="year-bar">
          <div class="bar big"><div style="width:${pct.toFixed(1)}%"></div></div>
          <p class="muted sm">${pct.toFixed(0)}% of ${year} has passed · <strong>${total - day} days left</strong></p>
        </div>`;
    }
    if (year > now) {
      const days = U.diffDays(U.todayKey(), `${year}-01-01`);
      return `<p class="muted sm">${year} starts in ${days} days. Plan it now.</p>`;
    }
    return `<p class="muted sm">${year} is finished.</p>`;
  }

  function roadmap(goals, year) {
    const todayPos = yearPos(U.todayKey(), year);
    const curMonth = new Date().getMonth();
    const monthHead = U.MONTHS_SHORT.map((m, i) => `<span class="${todayPos != null && curMonth === i ? 'cur' : ''}">${m}</span>`).join('');
    const marker = todayPos != null ? `<div class="g-today" style="left:${todayPos}%"></div>` : '';
    const rows = goals.map((g) => {
      const c = App.store.category(g.category).color;
      const left = (g.startMonth / 12) * 100;
      const width = ((g.endMonth - g.startMonth + 1) / 12) * 100;
      const ms = g.milestones.map((m) => {
        const p = yearPos(m.date, year);
        if (p == null) return '';
        return `<button type="button" class="g-ms ${m.done ? 'done' : ''}" style="left:${p}%;--c:${U.esc(c)}" data-action="toggle-ms" data-goal="${g.id}" data-ms="${m.id}"
          title="${U.esc(m.title)} · ${U.fmtDate(m.date, { month: 'short', day: 'numeric' })}" aria-label="Step ${U.esc(m.title)}"></button>`;
      }).join('');
      return `
        <div class="g-row">
          <div class="g-label" data-action="edit-goal" data-id="${g.id}" role="button" tabindex="0">
            <i style="background:${U.esc(c)}"></i><span>${U.esc(g.title)}</span>
          </div>
          <div class="g-track">
            ${marker}
            <div class="g-bar" style="left:${left}%;width:${width}%;--c:${U.esc(c)}" data-action="edit-goal" data-id="${g.id}" title="${U.esc(g.title)} · ${S.goalProgress(g)}%">
              <div class="g-fill" style="width:${S.goalProgress(g)}%"></div><span>${S.goalProgress(g)}%</span>
            </div>
            ${ms}
          </div>
        </div>`;
    }).join('');

    return `
      <section class="card">
        <div class="card-head"><h3>${icon('calendar')} ${year} at a glance</h3></div>
        <div class="gantt-scroll">
          <div class="gantt">
            <div class="g-row g-head"><div class="g-label"></div><div class="g-track g-months">${marker}${monthHead}</div></div>
            ${rows}
          </div>
        </div>
        <div class="legend"><span><i class="lg-ms"></i>Step</span><span><i class="lg-ms done"></i>Done</span>${todayPos != null ? '<span><i class="lg-today"></i>Today</span>' : ''}</div>
      </section>`;
  }

  function countdown(g) {
    const left = S.goalDaysLeft(g);
    if (S.goalProgress(g) >= 100) return 'Done 🎉';
    if (left < 0) return 'Time is up';
    if (left === 0) return 'Last day';
    return `${left} day${left === 1 ? '' : 's'} left`;
  }

  function moneyBlock(g) {
    const saved = S.goalSaved(g);
    if (!g.target && !saved) return '';
    const pct = g.target ? U.clamp((saved / g.target) * 100, 0, 100) : 0;
    return `
      <button type="button" class="money-box" data-action="goal-money" data-id="${g.id}">
        <span class="money-line"><span>${icon('target', 14)} Saved</span><strong>${U.money(saved)}${g.target ? ` <em>/ ${U.money(g.target)}</em>` : ''}</strong></span>
        ${g.target ? `<span class="bar"><span style="width:${pct}%"></span></span>
        <span class="muted sm">${saved >= g.target ? 'Target reached 🎉' : `${U.money(g.target - saved)} left`}</span>` : ''}
      </button>`;
  }

  function goalCard(g) {
    const c = App.store.category(g.category).color;
    const msDone = g.milestones.filter((m) => m.done).length;
    const progress = S.goalProgress(g);
    const today = U.todayKey();
    const tasks = App.store.state.tasks.filter((t) => t.goalId === g.id);
    const open = tasks.filter((t) => !S.isDone(t, t.date && t.date > today ? t.date : today))
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 3);
    return `
      <section class="card goal-card" style="--c:${U.esc(c)}">
        <div class="goal-head">
          <div>
            <h3>${U.esc(g.title)}</h3>
            <p class="muted sm">${U.MONTHS_SHORT[g.startMonth]} – ${U.MONTHS_SHORT[g.endMonth]} ${g.year} · <strong class="countdown">${countdown(g)}</strong></p>
          </div>
          <button type="button" class="icon-btn" data-action="edit-goal" data-id="${g.id}" aria-label="Edit goal">${icon('edit', 16)}</button>
        </div>
        <div class="goal-progress">
          <div class="bar"><div style="width:${progress}%"></div></div>
          <strong data-prog-label="${g.id}">${progress}%</strong>
        </div>
        ${g.milestones.length
          ? `<p class="muted sm">${msDone} of ${g.milestones.length} steps done</p>`
          : `<input type="range" min="0" max="100" step="5" value="${g.progress}" data-progress="${g.id}" aria-label="Progress for ${U.esc(g.title)}">`}
        ${moneyBlock(g)}
        ${g.milestones.length ? `<ul class="ms-list">${g.milestones.map((m) => `
          <li class="${m.done ? 'done' : ''}">
            <button type="button" class="mini-check ${m.done ? 'on' : ''}" style="--c:${U.esc(c)}" data-action="toggle-ms" data-goal="${g.id}" data-ms="${m.id}" aria-pressed="${m.done}" aria-label="Mark step done">${icon('check', 10)}</button>
            <span>${U.esc(m.title)}<small>${U.fmtDate(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}</small></span>
          </li>`).join('')}</ul>` : ''}
        ${open.length ? `<div class="goal-tasks"><span class="group-label">${icon('list', 13)} Next tasks</span>
          <div class="task-list">${open.map((t) => C.taskItem(t, t.date && t.date > today ? t.date : today, { showDate: true, hideGoal: true })).join('')}</div></div>` : ''}
        ${g.notes ? `<p class="goal-notes">${U.esc(g.notes)}</p>` : ''}
        <div class="goal-actions">
          <button type="button" class="btn ghost sm" data-action="new-task" data-goal="${g.id}">${icon('plus', 14)}Task</button>
          <button type="button" class="btn ghost sm" data-action="goal-money" data-id="${g.id}">${icon('target', 14)}Money</button>
          <button type="button" class="btn ghost sm" data-action="goal-ics" data-id="${g.id}" title="Add steps to phone calendar">${icon('bell', 14)}Phone calendar</button>
        </div>
      </section>`;
  }

  view.render = function () {
    const st = App.store.state;
    const year = view.year || new Date().getFullYear();
    const goals = st.goals.filter((g) => g.year === year).sort((a, b) => a.startMonth - b.startMonth || a.endMonth - b.endMonth);
    const counts = {};
    st.goals.forEach((g) => { counts[g.year] = (counts[g.year] || 0) + 1; });

    return `
      <div class="timeline-page">
        <div class="year-chips" role="tablist" aria-label="Year">
          ${years().map((y) => `
            <button type="button" class="tab ${y === year ? 'on' : ''}" data-action="pick-year" data-year="${y}" role="tab" aria-selected="${y === year}">
              ${y}${counts[y] ? `<em>${counts[y]}</em>` : ''}</button>`).join('')}
        </div>

        <section class="card year-hero">
          <div class="year-hero-main">
            <h2>Goals for ${year}</h2>
            ${yearInfo(year)}
          </div>
          <button type="button" class="btn primary" data-action="new-goal">${icon('plus', 16)}Add goal</button>
        </section>

        ${goals.length
          ? `<div class="goal-grid">${goals.map(goalCard).join('')}</div>${roadmap(goals, year)}`
          : `<section class="card">${C.empty('flag', `No goals for ${year} yet`, 'Add a big goal and the steps to reach it.',
              `<button type="button" class="btn primary sm" data-action="new-goal">${icon('plus', 14)}Add goal</button>`)}</section>`}
      </div>`;
  };

  view.onClick = function (e, a) {
    if (!a) return;
    const year = view.year || new Date().getFullYear();
    switch (a.dataset.action) {
      case 'pick-year':
        view.year = Number(a.dataset.year) === new Date().getFullYear() ? null : Number(a.dataset.year);
        App.render({ fresh: true });
        break;
      case 'new-goal':
        App.forms.goal(null, { year, startMonth: year === new Date().getFullYear() ? new Date().getMonth() : 0 });
        break;
      case 'toggle-ms': {
        const g = App.store.find('goals', a.dataset.goal);
        const m = g && g.milestones.find((x) => x.id === a.dataset.ms);
        if (!m) return;
        m.done = !m.done;
        App.store.save();
        if (m.done) App.ui.toast(S.goalProgress(g) >= 100 ? `Goal complete: ${g.title}! 🏆` : `Step done: ${m.title} 🎉`, { icon: 'trophy' });
        break;
      }
      default:
    }
  };

  view.onInput = function (e) {
    const t = e.target;
    if (!t.dataset.progress) return;
    const g = App.store.find('goals', t.dataset.progress);
    if (!g) return;
    g.progress = Number(t.value);
    const card = t.closest('.goal-card');
    card.querySelector('.bar > div').style.width = `${g.progress}%`;
    card.querySelector('[data-prog-label]').textContent = `${g.progress}%`;
    App.store.save({ silent: true });
  };

  view.onChange = function (e) {
    if (e.target.dataset.progress) {
      App.store.save();
      if (Number(e.target.value) === 100) App.ui.toast('Goal complete! Amazing work 🏆', { icon: 'trophy' });
    }
  };

  /* Show the goals page on a given year (used after saving a goal). */
  view.showYear = function (y) {
    view.year = y === new Date().getFullYear() ? null : y;
  };

  App.views.goals = view;
})();
