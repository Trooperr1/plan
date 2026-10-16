/* Habits — daily check-ins, streaks and a 12-week heatmap. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);

  const view = { title: 'Habits' };

  function heatmap(h) {
    const today = U.todayKey();
    const ws = App.store.state.settings.weekStart;
    const start = U.startOfWeek(U.addDays(today, -7 * 11), ws);
    const cells = [];
    for (let i = 0; i < 84; i++) {
      const k = U.addDays(start, i);
      const future = k > today;
      cells.push(`<i class="${S.habitDone(h, k) ? 'on' : ''} ${future ? 'future' : ''} ${k === today ? 'today' : ''}" title="${U.fmtDate(k)}${S.habitDone(h, k) ? ' ✓' : ''}"></i>`);
    }
    return `<div class="heatmap" aria-hidden="true">${cells.join('')}</div>`;
  }

  function weekRow(h) {
    const today = U.todayKey();
    return Array.from({ length: 7 }, (_, i) => {
      const k = U.addDays(today, i - 6);
      const d = U.fromKey(k);
      const on = S.habitDone(h, k);
      return `<button type="button" class="hd ${on ? 'on' : ''} ${k === today ? 'today' : ''}" data-action="toggle-habit" data-id="${h.id}" data-date="${k}"
        aria-pressed="${on}" aria-label="${U.esc(h.name)} · ${U.fmtDate(k)}">
        <span>${U.DAYS_MIN[d.getDay()]}</span><b>${on ? icon('check', 14) : d.getDate()}</b></button>`;
    }).join('');
  }

  view.render = function () {
    const st = App.store.state;
    const today = U.todayKey();
    const habits = st.habits;
    const doneToday = habits.filter((h) => S.habitDone(h, today)).length;
    const best = habits.reduce((m, h) => Math.max(m, S.streak(h)), 0);
    const avg = habits.length ? Math.round(habits.reduce((s, h) => s + S.habitRate(h, 30), 0) / habits.length) : 0;

    return `
      <div class="habits-page">
        <div class="summary-row">
          <div class="card stat-card">${C.progressRing(habits.length ? (doneToday / habits.length) * 100 : 0, 72)}<div><strong>${doneToday}/${habits.length}</strong><span>${T('done today')}</span></div></div>
          <div class="card stat-card"><span class="big-emoji">🔥</span><div><strong>${T('{n} days', { n: best })}</strong><span>${T('best current streak')}</span></div></div>
          <div class="card stat-card"><span class="big-emoji">📈</span><div><strong>${avg}%</strong><span>${T('consistency (30 days)')}</span></div></div>
          <button type="button" class="card stat-card add-card" data-action="new-habit">${icon('plus', 22)}<div><strong>${T('New habit')}</strong><span>${T('Build a routine')}</span></div></button>
        </div>

        ${habits.length ? `<div class="habit-grid">${habits.map((h) => {
          const streak = S.streak(h);
          return `
            <section class="card habit-card" style="--c:${U.esc(h.color)}">
              <div class="habit-head">
                <span class="habit-emoji">${U.esc(h.icon)}</span>
                <div class="habit-title">
                  <h3>${U.esc(h.name)}</h3>
                  <p>${streak ? T('🔥 {n} day streak', { n: streak }) : T('Start your streak today')} · ${T('Best {n}', { n: S.bestStreak(h) })} · ${T('{pct}% last 30 days', { pct: S.habitRate(h, 30) })}</p>
                </div>
                <button type="button" class="icon-btn" data-action="edit-habit" data-id="${h.id}" aria-label="${T('Edit habit')}">${icon('edit', 16)}</button>
              </div>
              <div class="habit-week">${weekRow(h)}</div>
              <div class="heat-wrap"><span class="muted sm">${T('Last 12 weeks')}</span>${heatmap(h)}</div>
            </section>`;
        }).join('')}</div>` : `<section class="card">${C.empty('flame', T('No habits yet'), T('Small daily actions create big results. Add your first habit.'),
          `<button type="button" class="btn primary sm" data-action="new-habit">${icon('plus', 14)}${T('New habit')}</button>`)}</section>`}
      </div>`;
  };

  App.views.habits = view;
})();
