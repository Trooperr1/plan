/* Goals — big goals that can run across years (e.g. Aug 2026 → Aug 2027), with steps, money and a timeline. */
(function () {
  const App = window.App;
  const U = App.util;
  const C = App.c;
  const S = App.sched;
  const T = (x, v) => App.t(x, v);
  const icon = (n, s) => App.icon(n, s);

  // tab: 'all' or a year number
  const view = { title: 'Goals', tab: 'all' };

  const thisYear = () => new Date().getFullYear();
  const mkOf = (n) => `${Math.floor(n / 12)}-${U.pad((n % 12) + 1)}`; // month number → "YYYY-MM"

  /* Tabs: All, this year, the next four, and any year a goal runs in. */
  function years() {
    const now = thisYear();
    const set = new Set([now, now + 1, now + 2, now + 3, now + 4]);
    App.store.state.goals.forEach((g) => {
      for (let y = Number(g.start.slice(0, 4)); y <= Number(g.end.slice(0, 4)); y++) set.add(y);
    });
    return [...set].sort((a, b) => a - b);
  }

  function yearInfo(year) {
    const now = thisYear();
    if (year === now) {
      const day = U.dayOfYear(U.todayKey());
      const total = U.daysInYear(year);
      const pct = (day / total) * 100;
      return `
        <div class="year-bar">
          <div class="bar big"><div style="width:${pct.toFixed(1)}%"></div></div>
          <p class="muted sm">${T('{pct}% of {year} has passed', { pct: pct.toFixed(0), year })} · <strong>${T('{n} days left', { n: total - day })}</strong></p>
        </div>`;
    }
    if (year > now) return `<p class="muted sm">${T('{year} starts in {n} days. Plan it now.', { year, n: U.diffDays(U.todayKey(), `${year}-01-01`) })}</p>`;
    return `<p class="muted sm">${T('{year} is finished.', { year })}</p>`;
  }

  /* Timeline from month `from` to month `to` (month numbers). Bars and steps are placed on one scale. */
  function roadmap(goals, from, to, heading) {
    const total = to - from + 1;
    const posDay = (key) => {
      const d = U.fromKey(key);
      const n = d.getFullYear() * 12 + d.getMonth();
      if (n < from || n > to) return null;
      return ((n - from + (d.getDate() - 0.5) / U.daysInMonth(d.getFullYear(), d.getMonth())) / total) * 100;
    };
    const todayPos = posDay(U.todayKey());
    const marker = todayPos != null ? `<div class="g-today" style="--x:${todayPos.toFixed(2)}%"></div>` : '';
    const curMonth = S.monthNum(U.todayKey().slice(0, 7));
    const many = total > 14;
    // Month labels when short; year labels at each January (and the start) when long.
    const head = Array.from({ length: total }, (_, i) => {
      const n = from + i;
      const mo = n % 12;
      const label = many ? (mo === 0 || i === 0 ? `${Math.floor(n / 12)}` : '') : `${U.MONTHS_SHORT[mo]}${mo === 0 && i > 0 ? ` ${Math.floor(n / 12)}` : ''}`;
      return `<span class="${n === curMonth ? 'cur' : ''} ${mo === 0 ? 'jan' : ''}">${label}</span>`;
    }).join('');
    const rows = goals.map((g) => {
      const c = App.store.category(g.category).color;
      const s = Math.max(S.monthNum(g.start), from);
      const e = Math.min(S.monthNum(g.end), to);
      const p = S.goalProgress(g);
      const before = S.monthNum(g.start) < from;
      const after = S.monthNum(g.end) > to;
      const ms = g.milestones.map((m) => {
        const x = posDay(m.date);
        if (x == null) return '';
        return `<button type="button" class="g-ms ${m.done ? 'done' : ''}" style="--x:${x.toFixed(2)}%;--c:${U.esc(c)}" data-action="toggle-ms" data-goal="${g.id}" data-ms="${m.id}"
          title="${U.esc(m.title)} · ${U.fmtDate(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}" aria-label="${T('Step')}: ${U.esc(m.title)}"></button>`;
      }).join('');
      return `
        <div class="g-row ${g.achieved ? 'achieved' : ''}">
          <div class="g-label" data-action="edit-goal" data-id="${g.id}" role="button" tabindex="0">
            <i style="background:${U.esc(c)}"></i><span>${g.achieved ? '🏆 ' : ''}${U.esc(g.title)}</span>
          </div>
          <div class="g-track" style="--months:${total}">
            ${marker}
            <div class="g-bar ${before ? 'cut-start' : ''} ${after ? 'cut-end' : ''}" style="--x:${(((s - from) / total) * 100).toFixed(2)}%;width:${(((e - s + 1) / total) * 100).toFixed(2)}%;--c:${U.esc(c)}"
              data-action="edit-goal" data-id="${g.id}" title="${U.esc(g.title)} · ${U.esc(S.goalRange(g))} · ${p}%">
              <div class="g-fill" style="width:${p}%"></div><span>${p}%</span>
            </div>
            ${ms}
          </div>
        </div>`;
    }).join('');
    return `
      <section class="card">
        <div class="card-head"><h3>${icon('calendar')} ${heading}</h3><span class="muted sm">${U.esc(`${U.MONTHS_SHORT[from % 12]} ${Math.floor(from / 12)} – ${U.MONTHS_SHORT[to % 12]} ${Math.floor(to / 12)}`)}</span></div>
        <div class="gantt-scroll">
          <div class="gantt ${many ? 'long' : ''}" style="--months:${total}">
            <div class="g-row g-head"><div class="g-label"></div><div class="g-track g-months" style="--months:${total}">${marker}${head}</div></div>
            ${rows}
          </div>
        </div>
        <div class="legend"><span><i class="lg-ms"></i>${T('Step')}</span><span><i class="lg-ms done"></i>${T('Done')}</span>${todayPos != null ? `<span><i class="lg-today"></i>${T('Today')}</span>` : ''}<span>⋯ ${T('continues')}</span></div>
      </section>`;
  }

  function countdown(g) {
    if (g.achieved) return `🏆 ${T('Achieved')}`;
    const left = S.goalDaysLeft(g);
    const startsIn = U.diffDays(U.todayKey(), S.goalStart(g));
    if (S.goalProgress(g) >= 100) return T('Done 🎉');
    if (startsIn > 0) return T('Starts in {n} days', { n: startsIn });
    if (left < 0) return T('Time is up');
    if (left === 0) return T('Last day');
    return T('{n} days left', { n: left });
  }

  function moneyBlock(g) {
    const saved = S.goalSaved(g);
    if (!g.target && !saved) return '';
    const pct = g.target ? U.clamp((saved / g.target) * 100, 0, 100) : 0;
    return `
      <button type="button" class="money-box" data-action="goal-money" data-id="${g.id}">
        <span class="money-line"><span>${icon('target', 14)} ${T('Money saved')}</span><strong>${U.money(saved)}${g.target ? ` <em>/ ${U.money(g.target)}</em>` : ''}</strong></span>
        ${g.target ? `<span class="bar"><span style="width:${pct}%"></span></span>
        <span class="muted sm">${saved >= g.target ? T('Target reached 🎉') : T('{amount} left', { amount: U.money(g.target - saved) })}</span>` : ''}
      </button>`;
  }

  function goalCard(g) {
    const c = App.store.category(g.category).color;
    const msDone = g.milestones.filter((m) => m.done).length;
    const progress = S.goalProgress(g);
    const timePct = S.goalTimePassed(g);
    const today = U.todayKey();
    const tasks = App.store.state.tasks.filter((t) => t.goalId === g.id);
    const dayOf = (t) => (S.isRecurring(t) ? S.nextOccurrence(t, today) || today : t.date || today);
    const open = tasks.filter((t) => !S.isDone(t, dayOf(t))).sort((a, b) => dayOf(a).localeCompare(dayOf(b))).slice(0, 3);
    // Behind = less done than the share of time already gone.
    const pace = g.achieved || timePct <= 0 ? '' : progress + 10 < timePct
      ? `<span class="pace behind">${icon('alert', 12)} ${T('Behind schedule')}</span>`
      : `<span class="pace ok">${icon('check', 12)} ${T('On track')}</span>`;
    return `
      <section class="card goal-card ${g.achieved ? 'achieved' : ''}" style="--c:${U.esc(c)}">
        <div class="goal-head">
          <div class="goal-title">
            <h3>${g.achieved ? '🏆 ' : ''}${U.esc(g.title)}</h3>
            <p class="muted sm"><span class="goal-range">${icon('calendar', 12)} ${U.esc(S.goalRange(g))}</span> · <strong class="countdown">${countdown(g)}</strong></p>
          </div>
          <div class="goal-tools">
            <button type="button" class="icon-btn" data-action="edit-goal" data-id="${g.id}" aria-label="${T('Edit goal')}" title="${T('Edit goal')}">${icon('edit', 16)}</button>
            <button type="button" class="icon-btn danger-hover" data-action="delete-goal" data-id="${g.id}" aria-label="${T('Delete')}" title="${T('Delete')}">${icon('trash', 16)}</button>
          </div>
        </div>
        <div class="goal-progress">
          <div class="bar"><div style="width:${progress}%"></div></div>
          <strong data-prog-label="${g.id}">${progress}%</strong>
        </div>
        <div class="goal-sub muted sm">
          ${g.milestones.length ? `<span>${T('{done} of {total} steps done', { done: msDone, total: g.milestones.length })}</span>` : ''}
          ${!g.achieved ? `<span>${T('{pct}% of the time has passed', { pct: Math.round(timePct) })}</span>` : ''}
          ${pace}
        </div>
        ${!g.milestones.length && !g.achieved ? `<input type="range" min="0" max="100" step="5" value="${g.progress}" data-progress="${g.id}" aria-label="${T('Progress')}: ${U.esc(g.title)}">` : ''}
        ${moneyBlock(g)}
        ${g.milestones.length ? `<ul class="ms-list">${g.milestones.map((m) => `
          <li class="${m.done ? 'done' : ''}">
            <button type="button" class="mini-check ${m.done ? 'on' : ''}" style="--c:${U.esc(c)}" data-action="toggle-ms" data-goal="${g.id}" data-ms="${m.id}" aria-pressed="${m.done}" aria-label="${T('Done')}">${icon('check', 10)}</button>
            <span>${U.esc(m.title)}<small>${U.fmtDate(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}</small></span>
          </li>`).join('')}</ul>` : ''}
        ${open.length ? `<div class="goal-tasks"><span class="group-label">${icon('list', 13)} ${T('Next tasks')}</span>
          <div class="task-list">${open.map((t) => C.taskItem(t, dayOf(t), { showDate: true, hideGoal: true })).join('')}</div></div>` : ''}
        ${g.notes ? `<p class="goal-notes">${U.esc(g.notes)}</p>` : ''}
        <div class="goal-actions">
          ${g.achieved ? '' : `<button type="button" class="btn ghost sm" data-action="goal-step" data-id="${g.id}">${icon('plus', 14)}${T('Step')}</button>
          <button type="button" class="btn ghost sm" data-action="new-task" data-goal="${g.id}">${icon('plus', 14)}${T('Task')}</button>`}
          <button type="button" class="btn ghost sm" data-action="goal-money" data-id="${g.id}">${icon('target', 14)}${T('Money')}</button>
          <button type="button" class="btn ghost sm" data-action="goal-ics" data-id="${g.id}" title="${T('Add to phone calendar')}">${icon('bell', 14)}${T('Phone calendar')}</button>
          <button type="button" class="btn sm ${g.achieved ? 'ghost' : 'achieve'}" data-action="goal-achieve" data-id="${g.id}">
            ${g.achieved ? `${icon('repeat', 14)}${T('Not achieved yet')}` : `${icon('trophy', 14)}${T('Achieved')}`}</button>
        </div>
      </section>`;
  }

  view.render = function () {
    const st = App.store.state;
    const tab = view.tab;
    const all = st.goals.slice().sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    const list = tab === 'all' ? all : all.filter((g) => S.goalInYear(g, tab));
    const active = list.filter((g) => !g.achieved);
    const achieved = list.filter((g) => g.achieved);
    const counts = {};
    years().forEach((y) => { counts[y] = all.filter((g) => S.goalInYear(g, y)).length; });

    // Timeline range: one year on a year tab; on "All", from the earliest start (or this month) to the latest end.
    let from;
    let to;
    if (tab === 'all') {
      const nowN = S.monthNum(U.todayKey().slice(0, 7));
      from = Math.min(nowN, ...active.map((g) => S.monthNum(g.start)));
      to = Math.max(from + 11, ...active.map((g) => S.monthNum(g.end)));
      to = Math.min(to, from + 71); // at most 6 years wide
    } else {
      from = tab * 12;
      to = tab * 12 + 11;
    }

    const empty = tab === 'all'
      ? C.empty('flag', T('No goals yet'), T('Add a big goal, when it starts and ends, and the steps to reach it.'),
        `<button type="button" class="btn primary sm" data-action="new-goal">${icon('plus', 14)}${T('Add goal')}</button>`)
      : C.empty('flag', T('No goals for {year} yet', { year: tab }), T('Add a big goal and the steps to reach it.'),
        `<button type="button" class="btn primary sm" data-action="new-goal">${icon('plus', 14)}${T('Add goal')}</button>`);

    return `
      <div class="timeline-page">
        <div class="year-chips" role="tablist" aria-label="${T('Year')}">
          <button type="button" class="tab ${tab === 'all' ? 'on' : ''}" data-action="pick-year" data-year="all" role="tab" aria-selected="${tab === 'all'}">
            ${icon('flag', 14)}${T('All goals')}${all.length ? `<em>${all.length}</em>` : ''}</button>
          ${years().map((y) => `
            <button type="button" class="tab ${y === tab ? 'on' : ''}" data-action="pick-year" data-year="${y}" role="tab" aria-selected="${y === tab}">
              ${y}${counts[y] ? `<em>${counts[y]}</em>` : ''}</button>`).join('')}
        </div>

        <section class="card year-hero">
          <div class="year-hero-main">
            <h2>${tab === 'all' ? T('All my goals') : T('Goals for {year}', { year: tab })}</h2>
            ${tab === 'all'
              ? `<p class="muted sm">${T('{active} in progress · {done} achieved', { active: all.filter((g) => !g.achieved).length, done: all.filter((g) => g.achieved).length })}</p>`
              : yearInfo(tab)}
          </div>
          <div class="hero-buttons">
            <button type="button" class="btn primary" data-action="new-goal">${icon('plus', 16)}${T('Add goal')}</button>
            <a class="btn ghost" href="#/review">${icon('star', 16)}${T('Week review')}</a>
          </div>
        </section>

        ${!list.length ? `<section class="card">${empty}</section>` : `
          ${active.length ? `<div class="goal-grid">${active.map(goalCard).join('')}</div>` : ''}
          ${active.length ? roadmap(active, from, to, tab === 'all' ? T('Timeline') : T('{year} at a glance', { year: tab })) : ''}
          ${achieved.length ? `<div class="section-head"><h3>🏆 ${T('Achieved')} <span class="muted sm">${achieved.length}</span></h3></div>
            <div class="goal-grid">${achieved.map(goalCard).join('')}</div>` : ''}`}
      </div>`;
  };

  view.onClick = async function (e, a) {
    if (!a) return;
    switch (a.dataset.action) {
      case 'pick-year':
        view.tab = a.dataset.year === 'all' ? 'all' : Number(a.dataset.year);
        App.render({ fresh: true });
        break;
      case 'new-goal': {
        const now = U.todayKey().slice(0, 7);
        const y = view.tab === 'all' ? thisYear() : view.tab;
        const start = view.tab === 'all' || view.tab === thisYear() ? now : `${y}-01`;
        App.forms.goal(null, { start, end: mkOf(S.monthNum(start) + 12) });
        break;
      }
      case 'toggle-ms': {
        const g = App.store.find('goals', a.dataset.goal);
        const m = g && g.milestones.find((x) => x.id === a.dataset.ms);
        if (!m) return;
        m.done = !m.done;
        m.doneAt = m.done ? Date.now() : null;
        App.store.save();
        if (m.done) App.ui.toast(S.goalProgress(g) >= 100 ? T('Goal complete: {name}! 🏆', { name: g.title }) : T('Step done: {name} 🎉', { name: m.title }), { icon: 'trophy' });
        break;
      }
      case 'goal-step': App.forms.step(a.dataset.id); break;
      case 'delete-goal': App.actions.deleteGoal(a.dataset.id); break;
      case 'goal-achieve': {
        const g = App.store.find('goals', a.dataset.id);
        if (!g) return;
        g.achieved = !g.achieved;
        g.achievedAt = g.achieved ? Date.now() : null;
        App.store.save();
        App.ui.toast(g.achieved ? T('Goal complete: {name}! 🏆', { name: g.title }) : T('Goal moved back to in progress'), {
          icon: 'trophy',
          action: { label: T('Undo'), fn: () => { g.achieved = !g.achieved; g.achievedAt = g.achieved ? Date.now() : null; App.store.save(); } },
        });
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
    card.querySelector('.goal-progress .bar > div').style.width = `${g.progress}%`;
    card.querySelector('[data-prog-label]').textContent = `${g.progress}%`;
    App.store.save({ silent: true });
  };

  view.onChange = function (e) {
    if (e.target.dataset.progress) {
      App.store.save();
      if (Number(e.target.value) === 100) App.ui.toast(T('Goal complete! Amazing work 🏆'), { icon: 'trophy' });
    }
  };

  /* Show a goal after saving it: stay on "All", or switch to a year tab the goal runs in. */
  view.showGoal = function (g) {
    if (view.tab !== 'all' && !S.goalInYear(g, view.tab)) view.tab = Number(g.start.slice(0, 4));
  };
  view.showAll = function () {
    view.tab = 'all';
  };

  App.views.goals = view;
})();
