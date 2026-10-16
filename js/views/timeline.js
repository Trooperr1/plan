/* Year Timeline — yearly goals on a 12-month roadmap, milestones, months and a "year in pixels". */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);

  const view = { title: 'Year Timeline', year: null };

  function yearPos(key, year) {
    // Position (0–100%) of a date along the year.
    if (Number(key.slice(0, 4)) !== year) return null;
    return ((U.dayOfYear(key) - 0.5) / U.daysInYear(year)) * 100;
  }

  function yearProgress(year) {
    const now = new Date();
    if (year < now.getFullYear()) return { pct: 100, day: U.daysInYear(year), total: U.daysInYear(year) };
    if (year > now.getFullYear()) return { pct: 0, day: 0, total: U.daysInYear(year) };
    const day = U.dayOfYear(U.todayKey());
    return { pct: (day / U.daysInYear(year)) * 100, day, total: U.daysInYear(year) };
  }

  /* Per-day task completion for the whole year (used for pixels and month summaries). */
  function dayStats(year) {
    const today = U.todayKey();
    const out = {};
    for (let k = `${year}-01-01`; k <= `${year}-12-31`; k = U.addDays(k, 1)) {
      if (k > today) break;
      const s = S.dayStats(k);
      const habits = App.store.state.habits.filter((h) => S.habitDone(h, k)).length;
      out[k] = { ...s, habits };
    }
    return out;
  }

  function gantt(goals, year) {
    const today = U.todayKey();
    const todayPos = yearPos(today, year);
    const monthHead = U.MONTHS_SHORT.map((m, i) => `<span class="${todayPos != null && new Date().getMonth() === i ? 'cur' : ''}">${m}</span>`).join('');
    const marker = todayPos != null ? `<div class="g-today" style="left:${todayPos}%"></div>` : '';
    const rows = goals.length ? goals.map((g) => {
      const c = App.store.category(g.category).color;
      const left = (g.startMonth / 12) * 100;
      const width = ((g.endMonth - g.startMonth + 1) / 12) * 100;
      const ms = g.milestones.map((m) => {
        const p = yearPos(m.date, year);
        if (p == null) return '';
        return `<button type="button" class="g-ms ${m.done ? 'done' : ''}" style="left:${p}%;--c:${U.esc(c)}" data-action="toggle-ms" data-goal="${g.id}" data-ms="${m.id}"
          title="${U.esc(m.title)} — ${U.fmtDate(m.date, { month: 'short', day: 'numeric' })}${m.done ? ' ✓' : ''}" aria-label="Milestone ${U.esc(m.title)}"></button>`;
      }).join('');
      return `
        <div class="g-row">
          <div class="g-label" data-action="edit-goal" data-id="${g.id}" role="button" tabindex="0">
            <i style="background:${U.esc(c)}"></i><span>${U.esc(g.title)}</span><small>${g.progress}%</small>
          </div>
          <div class="g-track">
            ${marker}
            <div class="g-bar" style="left:${left}%;width:${width}%;--c:${U.esc(c)}" data-action="edit-goal" data-id="${g.id}" title="${U.esc(g.title)} · ${U.MONTHS_SHORT[g.startMonth]} – ${U.MONTHS_SHORT[g.endMonth]} · ${g.progress}%">
              <div class="g-fill" style="width:${g.progress}%"></div><span>${U.esc(g.title)}</span>
            </div>
            ${ms}
          </div>
        </div>`;
    }).join('') : `<div class="g-empty">${C.empty('flag', 'No goals for this year yet', 'Add your big goals and milestones to see your year at a glance.',
      `<button type="button" class="btn primary sm" data-action="new-goal">${icon('plus', 14)}Add a goal</button>`)}</div>`;

    return `
      <div class="gantt-scroll">
        <div class="gantt">
          <div class="g-row g-head"><div class="g-label"><span class="muted sm">Goals</span></div><div class="g-track g-months">${marker}${monthHead}</div></div>
          ${rows}
        </div>
      </div>
      <div class="legend"><span><i class="lg-bar"></i>Goal period & progress</span><span><i class="lg-ms"></i>Milestone</span><span><i class="lg-ms done"></i>Milestone done</span>${todayPos != null ? '<span><i class="lg-today"></i>Today</span>' : ''}</div>`;
  }

  function months(goals, year, stats) {
    const now = new Date();
    return U.MONTHS.map((name, i) => {
      const prefix = `${year}-${U.pad(i + 1)}`;
      const ms = [];
      goals.forEach((g) => g.milestones.forEach((m) => {
        if (m.date.startsWith(prefix)) ms.push({ ...m, goal: g });
      }));
      ms.sort((a, b) => a.date.localeCompare(b.date));
      let total = 0;
      let done = 0;
      Object.keys(stats).forEach((k) => {
        if (k.startsWith(prefix)) {
          total += stats[k].total;
          done += stats[k].done;
        }
      });
      const isCur = year === now.getFullYear() && i === now.getMonth();
      const isPast = year < now.getFullYear() || (year === now.getFullYear() && i < now.getMonth());
      const active = goals.filter((g) => g.startMonth <= i && g.endMonth >= i).length;
      return `
        <div class="card month-card ${isCur ? 'cur' : ''} ${isPast ? 'past' : ''}">
          <div class="month-head">
            <h4>${name}</h4>
            <button type="button" class="icon-btn sm" data-action="open-month" data-month="${i}" aria-label="Open ${name} in calendar" title="Open in calendar">${icon('calendar', 15)}</button>
          </div>
          <p class="muted sm">${active} active goal${active === 1 ? '' : 's'}${total ? ` · ${done}/${total} tasks done` : ''}</p>
          ${ms.length ? `<ul class="ms-list">${ms.map((m) => `
            <li class="${m.done ? 'done' : ''}">
              <button type="button" class="mini-check ${m.done ? 'on' : ''}" style="--c:${U.esc(App.store.category(m.goal.category).color)}" data-action="toggle-ms" data-goal="${m.goal.id}" data-ms="${m.id}" aria-pressed="${m.done}" aria-label="Toggle milestone">${icon('check', 10)}</button>
              <span>${U.esc(m.title)}<small>${U.fromKey(m.date).getDate()} ${U.MONTHS_SHORT[i]} · ${U.esc(m.goal.title)}</small></span>
            </li>`).join('')}</ul>` : '<p class="muted sm">No milestones.</p>'}
        </div>`;
    }).join('');
  }

  function pixels(year, stats) {
    const today = U.todayKey();
    const rows = U.MONTHS_SHORT.map((m, mi) => {
      const dim = U.daysInMonth(year, mi);
      const cells = Array.from({ length: 31 }, (_, di) => {
        if (di >= dim) return '<i class="none"></i>';
        const k = `${year}-${U.pad(mi + 1)}-${U.pad(di + 1)}`;
        const s = stats[k];
        let lvl = 'future';
        let label = U.fmtDate(k, { month: 'short', day: 'numeric' });
        if (s) {
          if (!s.total && !s.habits) lvl = 'l0';
          else {
            const ratio = s.total ? s.done / s.total : 1;
            lvl = ratio >= 1 ? 'l4' : ratio >= 0.66 ? 'l3' : ratio >= 0.33 ? 'l2' : 'l1';
            if (!s.total) lvl = 'l2';
          }
          label += ` · ${s.done}/${s.total} tasks · ${s.habits} habits`;
        }
        return `<i class="${lvl} ${k === today ? 'today' : ''}" data-action="open-day" data-date="${k}" title="${label}"></i>`;
      }).join('');
      return `<div class="px-row"><span>${m}</span><div class="px-cells">${cells}</div></div>`;
    }).join('');
    return `
      <div class="pixels">${rows}</div>
      <div class="legend"><span>Less</span><i class="px l0"></i><i class="px l1"></i><i class="px l2"></i><i class="px l3"></i><i class="px l4"></i><span>More done</span></div>`;
  }

  function goalCards(goals) {
    if (!goals.length) return '';
    return `<div class="goal-grid">${goals.map((g) => {
      const c = App.store.category(g.category).color;
      const msDone = g.milestones.filter((m) => m.done).length;
      return `
        <section class="card goal-card" style="--c:${U.esc(c)}">
          <div class="goal-head">
            <div>
              <h3>${U.esc(g.title)}</h3>
              <p class="muted sm">${C.categoryChip(g.category)} ${U.MONTHS_SHORT[g.startMonth]} – ${U.MONTHS_SHORT[g.endMonth]} · ${msDone}/${g.milestones.length} milestones</p>
            </div>
            <button type="button" class="icon-btn" data-action="edit-goal" data-id="${g.id}" aria-label="Edit goal">${icon('edit', 16)}</button>
          </div>
          <div class="goal-progress">
            <div class="bar"><div style="width:${g.progress}%"></div></div>
            <strong data-prog-label="${g.id}">${g.progress}%</strong>
          </div>
          <input type="range" min="0" max="100" step="5" value="${g.progress}" data-progress="${g.id}" aria-label="Progress for ${U.esc(g.title)}">
          ${g.milestones.length ? `<ul class="ms-list">${g.milestones.map((m) => `
            <li class="${m.done ? 'done' : ''}">
              <button type="button" class="mini-check ${m.done ? 'on' : ''}" style="--c:${U.esc(c)}" data-action="toggle-ms" data-goal="${g.id}" data-ms="${m.id}" aria-pressed="${m.done}" aria-label="Toggle milestone">${icon('check', 10)}</button>
              <span>${U.esc(m.title)}<small>${U.fmtDate(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}</small></span>
            </li>`).join('')}</ul>` : ''}
          ${g.notes ? `<p class="goal-notes">${U.esc(g.notes)}</p>` : ''}
        </section>`;
    }).join('')}</div>`;
  }

  view.render = function () {
    const st = App.store.state;
    const year = view.year || new Date().getFullYear();
    const goals = st.goals.filter((g) => g.year === year).sort((a, b) => a.startMonth - b.startMonth || a.endMonth - b.endMonth);
    const yp = yearProgress(year);
    const stats = dayStats(year);
    const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;
    const allMs = goals.flatMap((g) => g.milestones);
    const msDone = allMs.filter((m) => m.done).length;
    const tasksDone = Object.values(stats).reduce((s, d) => s + d.done, 0);
    const theme = (st.years[year] && st.years[year].theme) || '';
    const left = yp.total - yp.day;

    return `
      <div class="timeline-page">
        <div class="toolbar">
          <div class="toolbar-left">
            <button type="button" class="icon-btn" data-action="year-prev" aria-label="Previous year">${icon('left')}</button>
            <button type="button" class="icon-btn" data-action="year-next" aria-label="Next year">${icon('right')}</button>
            <h2>${year}</h2>
            ${year !== new Date().getFullYear() ? '<button type="button" class="btn ghost sm" data-action="year-now">This year</button>' : ''}
          </div>
          <button type="button" class="btn primary" data-action="new-goal">${icon('plus', 16)}New goal</button>
        </div>

        <section class="card year-hero">
          <div class="year-hero-main">
            <label class="theme-input"><span>${icon('star', 15)} Theme / word of the year</span>
              <input type="text" id="yearTheme" maxlength="80" value="${U.esc(theme)}" placeholder="e.g. Focus, Health, Courage…" autocomplete="off"></label>
            <div class="year-bar">
              <div class="bar big"><div style="width:${yp.pct.toFixed(1)}%"></div></div>
              <p class="muted sm">${year === new Date().getFullYear()
                ? `Day ${yp.day} of ${yp.total} · ${yp.pct.toFixed(1)}% of the year has passed · <strong>${left} days left</strong> — make them count.`
                : year < new Date().getFullYear() ? 'This year is complete. Review your goals and lessons.' : 'This year has not started yet — plan ahead!'}</p>
            </div>
          </div>
          <ul class="stat-list">
            <li><strong>${goals.length}</strong><span>goals</span></li>
            <li><strong>${avg}%</strong><span>avg. progress</span></li>
            <li><strong>${msDone}/${allMs.length}</strong><span>milestones</span></li>
            <li><strong>${tasksDone}</strong><span>tasks done</span></li>
          </ul>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('flag')} Roadmap</h3><span class="muted sm">Tap a bar to edit · tap a diamond to complete a milestone</span></div>
          ${gantt(goals, year)}
        </section>

        ${goals.length ? `<div class="section-head"><h3>${icon('target')} Goals</h3></div>${goalCards(goals)}` : ''}

        <div class="section-head"><h3>${icon('calendar')} Month by month</h3></div>
        <div class="month-grid">${months(goals, year, stats)}</div>

        <section class="card">
          <div class="card-head"><h3>${icon('grid')} Year in pixels</h3><span class="muted sm">Each square is a day, coloured by how much you got done</span></div>
          <div class="pixels-scroll">${pixels(year, stats)}</div>
        </section>
      </div>`;
  };

  view.onClick = function (e, a) {
    if (!a) return;
    const year = view.year || new Date().getFullYear();
    switch (a.dataset.action) {
      case 'year-prev': view.year = year - 1; App.render({ fresh: true }); break;
      case 'year-next': view.year = year + 1; App.render({ fresh: true }); break;
      case 'year-now': view.year = null; App.render({ fresh: true }); break;
      case 'new-goal': App.forms.goal(null, { year, startMonth: year === new Date().getFullYear() ? new Date().getMonth() : 0 }); break;
      case 'toggle-ms': {
        const g = App.store.find('goals', a.dataset.goal);
        const m = g && g.milestones.find((x) => x.id === a.dataset.ms);
        if (!m) return;
        m.done = !m.done;
        App.store.save();
        if (m.done) App.ui.toast(`Milestone reached: ${m.title} 🎉`, { icon: 'trophy' });
        break;
      }
      case 'open-month':
        App.views.calendar.goto(`${year}-${U.pad(Number(a.dataset.month) + 1)}-01`, 'month');
        location.hash = '#/calendar';
        break;
      default:
    }
  };

  view.onInput = function (e) {
    const t = e.target;
    if (t.id === 'yearTheme') {
      const year = view.year || new Date().getFullYear();
      const st = App.store.state;
      st.years[year] = { ...(st.years[year] || {}), theme: t.value };
      App.store.save({ silent: true });
    } else if (t.dataset.progress) {
      const g = App.store.find('goals', t.dataset.progress);
      if (!g) return;
      g.progress = Number(t.value);
      const card = t.closest('.goal-card');
      card.querySelector('.bar > div').style.width = `${g.progress}%`;
      card.querySelector('[data-prog-label]').textContent = `${g.progress}%`;
      App.store.save({ silent: true });
    }
  };

  view.onChange = function (e) {
    if (e.target.dataset.progress) {
      App.store.save();
      if (Number(e.target.value) === 100) App.ui.toast('Goal complete! Amazing work 🏆', { icon: 'trophy' });
    }
  };

  App.views.timeline = view;
})();
