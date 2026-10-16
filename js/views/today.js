/* "My Day" — today's tasks and schedule. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);

  const view = { title: 'My Day', date: null };

  /* "Call mom at 5pm" → title + time. Also understands #category and !high. */
  function parseQuick(text) {
    const cats = App.store.state.categories;
    let time = null;
    let priority = 'medium';
    let category = null;
    let title = ` ${text} `;
    title = title.replace(/\s!(high|h|medium|med|m|low|l)(?=\s)/i, (m, p) => {
      const c = p[0].toLowerCase();
      priority = c === 'h' ? 'high' : c === 'l' ? 'low' : 'medium';
      return ' ';
    });
    title = title.replace(/\s#([\w-]+)(?=\s)/, (m, c) => {
      const cat = cats.find((x) => x.name.toLowerCase() === c.toLowerCase() || x.id === c.toLowerCase());
      if (!cat) return m;
      category = cat.id;
      return ' ';
    });
    title = title.replace(/\s(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s?(am|pm)(?=\s)/i, (m, h, mi, ap) => {
      h = Number(h);
      if (h < 1 || h > 12) return m;
      h = (h % 12) + (ap.toLowerCase() === 'pm' ? 12 : 0);
      time = `${U.pad(h)}:${mi || '00'}`;
      return ' ';
    });
    if (!time) {
      title = title.replace(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m, h, mi) => {
        time = `${U.pad(Number(h))}:${mi}`;
        return ' ';
      });
    }
    return { title: title.replace(/\s+/g, ' ').trim(), time, priority, category };
  }

  function schedule(key, isToday) {
    const items = S.agenda(key);
    if (!items.length) {
      return C.empty('calendar', 'Nothing scheduled', '',
        `<button class="btn ghost sm" data-action="new-event" data-date="${key}">${icon('plus', 14)}Add event</button>`);
    }
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let nowPlaced = !isToday;
    const rows = [];
    const nowLine = `<li class="now-line" title="Now · ${U.fmtTime(U.fromMin(nowMin))}"><span>Now</span></li>`;
    items.forEach((it) => {
      if (!nowPlaced && it.start && U.toMin(it.start) > nowMin) {
        rows.push(nowLine);
        nowPlaced = true;
      }
      const cat = App.store.category(it.item.category);
      const live = isToday && it.start && it.end && U.toMin(it.start) <= nowMin && U.toMin(it.end) > nowMin;
      const past = isToday && ((it.end && U.toMin(it.end) <= nowMin) || (!it.end && it.start && U.toMin(it.start) < nowMin));
      if (it.kind === 'event') {
        const e = it.item;
        rows.push(`
          <li class="agenda-item ${live ? 'live' : ''} ${past ? 'past' : ''}" style="--c:${U.esc(cat.color)}" data-action="edit-event" data-id="${e.id}" role="button" tabindex="0">
            <div class="agenda-time">${e.allDay ? 'All day' : `${U.fmtTime(e.start)}<small>${U.fmtTime(e.end)}</small>`}</div>
            <div class="agenda-bar"></div>
            <div class="agenda-body">
              <strong>${U.esc(e.title)}</strong>
              <span>${[e.location && U.esc(e.location), live && '<b class="live-tag">Now</b>'].filter(Boolean).join(' · ')}</span>
            </div>
          </li>`);
      } else {
        const t = it.item;
        const done = S.isDone(t, key);
        rows.push(`
          <li class="agenda-item task ${done ? 'done' : ''} ${past && !done ? 'past' : ''}" style="--c:${U.esc(cat.color)}">
            <div class="agenda-time">${U.fmtTime(t.time)}</div>
            <div class="agenda-bar"></div>
            <div class="agenda-body" data-action="edit-task" data-id="${t.id}" role="button" tabindex="0">
              <strong>${U.esc(t.title)}</strong>
              <span>Task${done ? ' · Done' : ''}</span>
            </div>
            <button type="button" class="check sm ${done ? 'on' : ''}" data-action="toggle-task" data-id="${t.id}" data-date="${key}" aria-label="Toggle done" aria-pressed="${done}">${icon('check', 12)}</button>
          </li>`);
      }
    });
    if (!nowPlaced) rows.push(nowLine);
    return `<ol class="agenda">${rows.join('')}</ol>`;
  }

  function habits(key) {
    const st = App.store.state;
    if (!st.settings.showHabits) return '';
    return `
      <section class="card">
        <div class="card-head">
          <h3>${icon('flame')} Habits</h3>
          <a class="btn ghost sm" href="#/habits">View all</a>
        </div>
        ${st.habits.length ? `<div class="habit-chips">${st.habits.map((h) => {
          const on = S.habitDone(h, key);
          const streak = S.streak(h);
          return `<button type="button" class="habit-chip ${on ? 'on' : ''}" style="--c:${U.esc(h.color)}" data-action="toggle-habit" data-id="${h.id}" data-date="${key}" aria-pressed="${on}">
            <span class="emoji">${U.esc(h.icon)}</span><span class="name">${U.esc(h.name)}</span>
            ${streak ? `<span class="streak">🔥${streak}</span>` : ''}<span class="tick">${icon('check', 12)}</span></button>`;
        }).join('')}</div>` : C.empty('flame', 'No habits yet', '', `<button class="btn ghost sm" data-action="new-habit">${icon('plus', 14)}Add habit</button>`)}
      </section>`;
  }

  view.render = function () {
    const st = App.store.state;
    const today = U.todayKey();
    const key = view.date || today;
    const isToday = key === today;
    const tasks = S.tasksOn(key);
    const late = isToday ? S.overdue(today) : [];
    const done = tasks.filter((t) => S.isDone(t, key)).length;
    const pct = tasks.length ? (done / tasks.length) * 100 : 0;
    const name = st.settings.name ? `, ${U.esc(st.settings.name)}` : '';
    const heading = isToday ? `${U.greeting()}${name}` : U.relDay(key);

    const taskList = tasks.length
      ? tasks.map((t) => C.taskItem(t, key, { showSubs: true })).join('')
      : C.empty('check', 'No tasks yet', 'Type a task below and press Add.');

    return `
      <div class="today">
        <section class="card hero">
          <div class="hero-main">
            <div class="day-nav">
              <button type="button" class="icon-btn" data-action="day-prev" aria-label="Previous day">${icon('left')}</button>
              <button type="button" class="btn ghost sm" data-action="day-today" ${isToday ? 'disabled' : ''}>Today</button>
              <button type="button" class="icon-btn" data-action="day-next" aria-label="Next day">${icon('right')}</button>
              <label class="date-jump" title="Pick a date">${icon('calendar', 16)}<input type="date" id="dayJump" value="${key}" aria-label="Pick a date"></label>
            </div>
            <h2>${heading}</h2>
            <p class="muted">${U.fmtDate(key, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          ${tasks.length ? `<div class="hero-stats">${C.progressRing(pct, 88, `${done} of ${tasks.length}`)}</div>` : ''}
        </section>

        <div class="today-cols">
          <div class="col">
            <section class="card">
              <div class="card-head"><h3>${icon('list')} Tasks</h3></div>
              ${late.length ? `
                <div class="group-label danger">${icon('alert', 14)} Overdue <span>${late.length}</span></div>
                <div class="task-list">${late.map((t) => C.taskItem(t, t.date, { showDate: true })).join('')}</div>
                <div class="group-label">${icon('sun', 14)} ${isToday ? 'Today' : U.relDay(key)}</div>` : ''}
              <div class="task-list">${taskList}</div>
              <form class="quick-add" data-quick>
                <span>${icon('plus', 16)}</span>
                <input type="text" id="quickAdd" placeholder="Add a task…" autocomplete="off" aria-label="Add a task">
                <button type="submit" class="btn primary sm">Add</button>
              </form>
            </section>
          </div>

          <div class="col">
            <section class="card">
              <div class="card-head">
                <h3>${icon('clock')} Schedule</h3>
                <button type="button" class="btn ghost sm" data-action="new-event" data-date="${key}">${icon('plus', 14)}Event</button>
              </div>
              ${schedule(key, isToday)}
            </section>
            ${habits(key)}
          </div>
        </div>
      </div>`;
  };

  view.onClick = function (e, a) {
    if (!a) return;
    const key = view.date || U.todayKey();
    switch (a.dataset.action) {
      case 'day-prev': view.date = U.addDays(key, -1); App.render(); break;
      case 'day-next': view.date = U.addDays(key, 1); App.render(); break;
      case 'day-today': view.date = null; App.render(); break;
      default:
    }
  };

  view.onChange = function (e) {
    if (e.target.id === 'dayJump' && e.target.value) {
      view.date = e.target.value === U.todayKey() ? null : e.target.value;
      App.render();
    }
  };

  view.onSubmit = function (e) {
    if (!e.target.matches('[data-quick]')) return;
    e.preventDefault();
    const input = document.getElementById('quickAdd');
    const parsed = parseQuick(input.value);
    if (!parsed.title) {
      input.focus();
      return;
    }
    const st = App.store.state;
    App.store.upsert('tasks', App.store.newTask({
      title: parsed.title,
      date: view.date || U.todayKey(),
      time: parsed.time,
      priority: parsed.priority,
      category: parsed.category || App.store.defaultCategory(),
      reminder: parsed.time ? st.settings.defaultReminder : null,
    }));
    App.ui.toast(`Added “${parsed.title}”${parsed.time ? ` at ${U.fmtTime(parsed.time)}` : ''}`);
    const again = document.getElementById('quickAdd');
    if (again) {
      again.value = '';
      again.focus();
    }
  };

  view.parseQuick = parseQuick;
  App.views = App.views || {};
  App.views.today = view;
})();
