/* Sunday review — what you finished this week and what is next for your goals. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);

  const view = { title: 'Week review', end: null };

  /* The review covers the 7 days that end on a Sunday. */
  function lastSunday() {
    const t = U.todayKey();
    return U.addDays(t, -U.weekday(t));
  }

  view.record = function (end, create) {
    const all = App.store.state.reviews;
    if (!all[end] && create) all[end] = { notes: '', seen: false };
    return all[end] || {};
  };

  /* True on a Sunday when this week's review has not been opened or put off yet. */
  view.due = function () {
    const st = App.store.state;
    const today = U.todayKey();
    if (U.weekday(today) !== 0) return false;
    if (!st.tasks.length && !st.goals.length && !st.events.length) return false;
    const r = st.reviews[today];
    return !(r && (r.seen || r.later));
  };

  function range(start, end) {
    const a = U.fromKey(start);
    const b = U.fromKey(end);
    if (App.i18n.lang() === 'ckb') {
      return a.getMonth() === b.getMonth()
        ? `${a.getDate()} – ${b.getDate()}ی ${U.MONTHS[b.getMonth()]} ${b.getFullYear()}`
        : `${a.getDate()}ی ${U.MONTHS[a.getMonth()]} – ${b.getDate()}ی ${U.MONTHS[b.getMonth()]} ${b.getFullYear()}`;
    }
    return `${U.fmtDate(start, { month: 'short', day: 'numeric' })} – ${U.fmtDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  function collect(start, end) {
    const st = App.store.state;
    const today = U.todayKey();
    const out = { total: 0, done: 0, events: 0, finished: [], repeats: {}, open: [], steps: [], money: [], habitDone: 0, habitTotal: 0 };
    for (let k = start; k <= end; k = U.addDays(k, 1)) {
      if (k > today) break;
      out.events += S.eventsOn(k).length;
      S.tasksOn(k).forEach((t) => {
        const done = S.isDone(t, k);
        out.total++;
        if (done) out.done++;
        if (S.isRecurring(t)) {
          const r = out.repeats[t.id] || (out.repeats[t.id] = { t, done: 0, of: 0 });
          r.of++;
          if (done) r.done++;
        } else if (done) out.finished.push({ t, k });
        else out.open.push(t);
      });
      if (st.settings.showHabits) {
        st.habits.forEach((h) => {
          out.habitTotal++;
          if (S.habitDone(h, k)) out.habitDone++;
        });
      }
    }
    const from = U.fromKey(start).getTime();
    const to = U.fromKey(U.addDays(end, 1)).getTime();
    st.goals.forEach((g) => {
      g.milestones.forEach((m) => { if (m.done && m.doneAt >= from && m.doneAt < to) out.steps.push({ m, g }); });
      (g.savings || []).forEach((x) => { if (x.date >= start && x.date <= end) out.money.push({ x, g }); });
    });
    return out;
  }

  function message(pct, total) {
    if (!total) return T('No tasks this week. Plan next week below.');
    if (pct >= 80) return T('Great week! 🌟');
    if (pct >= 50) return T('Good work. Keep going! 💪');
    return T('Every step counts. Next week will be better.');
  }

  function goalsNext() {
    const today = U.todayKey();
    const goals = App.store.state.goals
      .filter((g) => S.goalProgress(g) < 100 && S.goalEnd(g) >= today)
      .sort((a, b) => S.goalEnd(a).localeCompare(S.goalEnd(b)));
    if (!goals.length) {
      return C.empty('flag', T('No active goals'), T('Add a big goal and the steps to reach it.'),
        `<a class="btn ghost sm" href="#/goals">${icon('plus', 14)}${T('Add goal')}</a>`);
    }
    return `<div class="review-goals">${goals.map((g) => {
      const c = App.store.category(g.category).color;
      const p = S.goalProgress(g);
      const next = g.milestones.filter((m) => !m.done).sort((a, b) => a.date.localeCompare(b.date))[0];
      const saved = S.goalSaved(g);
      return `
        <div class="review-goal" style="--c:${U.esc(c)}">
          <div class="rg-head"><strong>${U.esc(g.title)}</strong><span>${p}%</span></div>
          <span class="bar"><span style="width:${p}%"></span></span>
          <p class="sm">${next
            ? `${icon('right', 13)} ${T('Next step')}: <b>${U.esc(next.title)}</b> · ${U.fmtDate(next.date, { day: 'numeric', month: 'short', year: 'numeric' })}`
            : `<span class="muted">${T('No steps yet')}</span>`}</p>
          <p class="muted sm">${T('{n} days left', { n: S.goalDaysLeft(g) })}${g.target ? ` · ${saved >= g.target ? T('Target reached 🎉') : T('{amount} left', { amount: U.money(g.target - saved) })}` : ''}</p>
          <button type="button" class="btn ghost sm" data-action="new-task" data-goal="${g.id}">${icon('plus', 14)}${T('Task for this goal')}</button>
        </div>`;
    }).join('')}</div>`;
  }

  view.render = function () {
    const latest = lastSunday();
    const end = view.end && view.end < latest ? view.end : latest;
    const start = U.addDays(end, -6);
    const r = collect(start, end);
    const pct = r.total ? (r.done / r.total) * 100 : 0;
    const rec = view.record(end, true);
    if (end === latest && !rec.seen) {
      rec.seen = true;
      App.store.save({ silent: true });
    }

    const nextStart = U.addDays(end, 1);
    let nextTasks = 0;
    let nextEvents = 0;
    for (let i = 0; i < 7; i++) {
      const k = U.addDays(nextStart, i);
      nextTasks += S.tasksOn(k).length;
      nextEvents += S.eventsOn(k).length;
    }
    const moneySum = r.money.reduce((s, m) => s + (Number(m.x.amount) || 0), 0);
    const spentWeek = App.money.totals(App.money.entriesIn(start, end)).spent;
    const repeats = Object.values(r.repeats);

    const finished = [
      ...r.finished.map(({ t, k }) => `<li>${icon('check', 14)}<span>${U.esc(t.title)}<small>${U.fmtDate(k, { weekday: 'long' })}</small></span></li>`),
      ...repeats.filter((x) => x.done).map((x) => `<li>${icon('repeat', 14)}<span>${U.esc(x.t.title)}<small>${T('{done} of {total} days', { done: x.done, total: x.of })}</small></span></li>`),
      ...r.steps.map(({ m, g }) => `<li class="step">🏁<span>${U.esc(m.title)}<small>${U.esc(g.title)}</small></span></li>`),
      ...r.money.map(({ x, g }) => `<li class="money">💰<span>${U.money(x.amount)}<small>${U.esc(g.title)}</small></span></li>`),
    ];

    return `
      <div class="review-page">
        <div class="toolbar">
          <div class="toolbar-left">
            <button type="button" class="icon-btn" data-action="review-prev" aria-label="${T('Previous')}">${icon('left')}</button>
            <button type="button" class="icon-btn" data-action="review-next" aria-label="${T('Next')}" ${end >= latest ? 'disabled' : ''}>${icon('right')}</button>
            <h2>${range(start, end)}</h2>
          </div>
        </div>

        <section class="card review-hero">
          ${C.progressRing(pct, 96, T('{done} of {total}', { done: r.done, total: r.total }))}
          <div class="review-hero-main">
            <h2>${message(pct, r.total)}</h2>
            <ul class="stat-list wide">
              <li><strong>${r.done}/${r.total}</strong><span>${T('tasks done')}</span></li>
              <li><strong>${r.events}</strong><span>${T('events')}</span></li>
              <li><strong>${r.steps.length}</strong><span>${T('goal steps done')}</span></li>
              ${moneySum ? `<li><strong>${U.money(moneySum)}</strong><span>${T('saved this week')}</span></li>` : ''}
              ${spentWeek ? `<li><strong>${U.money(spentWeek)}</strong><span>${T('spent this week')}</span></li>` : ''}
              ${r.habitTotal ? `<li><strong>${Math.round((r.habitDone / r.habitTotal) * 100)}%</strong><span>${T('habits')}</span></li>` : ''}
            </ul>
          </div>
        </section>

        <div class="today-cols">
          <section class="card">
            <div class="card-head"><h3>${icon('trophy')} ${T('What you finished')}</h3></div>
            ${finished.length ? `<ul class="review-list">${finished.join('')}</ul>` : `<p class="muted sm">${T('Nothing finished this week yet.')}</p>`}
          </section>

          <section class="card">
            <div class="card-head"><h3>${icon('alert')} ${T('Not finished')}</h3>
              ${r.open.length ? `<button type="button" class="btn ghost sm" data-action="review-move" data-start="${start}" data-end="${end}">${icon('right', 14)}${nextStart >= U.todayKey() ? T('Move to next week') : T('Move all to today')}</button>` : ''}</div>
            ${r.open.length
              ? `<div class="task-list">${r.open.map((t) => C.taskItem(t, t.date, { showDate: true })).join('')}</div>`
              : `<p class="muted sm">${T('Everything is done. Well done!')}</p>`}
          </section>
        </div>

        <section class="card">
          <div class="card-head"><h3>${icon('flag')} ${T('Next for your goals')}</h3></div>
          ${goalsNext()}
        </section>

        <div class="today-cols">
          <section class="card">
            <div class="card-head"><h3>${icon('calendar')} ${T('Next week')}</h3></div>
            <p class="muted">${T('{tasks} tasks and {events} events are planned.', { tasks: nextTasks, events: nextEvents })}</p>
            <div class="btn-row">
              <button type="button" class="btn primary sm" data-action="new-task" data-date="${nextStart >= U.todayKey() ? nextStart : U.todayKey()}">${icon('plus', 14)}${T('Add task')}</button>
              <button type="button" class="btn ghost sm" data-action="review-calendar" data-date="${nextStart}">${icon('calendar', 14)}${T('Open calendar')}</button>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h3>${icon('note')} ${T('Your notes')}</h3><span class="muted sm" id="reviewSaved"></span></div>
            <textarea id="reviewNotes" class="notes-box" rows="4" placeholder="${T('What went well? What will you do better next week?')}">${U.esc(rec.notes || '')}</textarea>
          </section>
        </div>
      </div>`;
  };

  const saveNotes = U.debounce(() => {
    App.store.save({ silent: true });
    const el = document.getElementById('reviewSaved');
    if (el) el.textContent = T('Saved');
  }, 500);

  view.onInput = function (e) {
    if (e.target.id !== 'reviewNotes') return;
    const end = view.end && view.end < lastSunday() ? view.end : lastSunday();
    view.record(end, true).notes = e.target.value;
    saveNotes();
  };

  view.onClick = function (e, a) {
    if (!a) return;
    const latest = lastSunday();
    const end = view.end && view.end < latest ? view.end : latest;
    switch (a.dataset.action) {
      case 'review-prev': view.end = U.addDays(end, -7); App.render({ fresh: true }); break;
      case 'review-next': view.end = U.addDays(end, 7) >= latest ? null : U.addDays(end, 7); App.render({ fresh: true }); break;
      case 'review-calendar':
        App.views.calendar.goto(a.dataset.date, 'week');
        location.hash = '#/calendar';
        break;
      default:
    }
  };

  App.views.review = view;
})();
