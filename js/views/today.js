/* "My Day" — the daily planner dashboard. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);
  const MOODS = [['awful', '😞'], ['meh', '😐'], ['okay', '🙂'], ['good', '😄'], ['great', '🤩']];

  const view = { title: 'My Day', date: null };

  /* "Call mom at 5pm #personal !high" → title + time + category + priority */
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
      return C.empty('calendar', 'Nothing scheduled', 'Add an event or give a task a time to see it here.',
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
              <span>${[e.location && U.esc(e.location), U.esc(cat.name), live && '<b class="live-tag">Happening now</b>'].filter(Boolean).join(' · ')}</span>
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
              <span>Task · ${U.esc(cat.name)}${done ? ' · Done' : ''}</span>
            </div>
            <button type="button" class="check sm ${done ? 'on' : ''}" data-action="toggle-task" data-id="${t.id}" data-date="${key}" aria-label="Toggle done" aria-pressed="${done}">${icon('check', 12)}</button>
          </li>`);
      }
    });
    if (!nowPlaced) rows.push(nowLine);
    return `<ol class="agenda">${rows.join('')}</ol>`;
  }

  function reminders() {
    const list = App.reminders.upcoming(48).slice(0, 6);
    if (!list.length) return C.empty('bell', 'No upcoming reminders', 'Add a time and a reminder to a task or event.');
    return `<ul class="reminder-list">${list.map((r) => `
      <li data-action="${r.kind === 'task' ? 'edit-task' : 'edit-event'}" data-id="${r.item.id}" role="button" tabindex="0">
        <span class="rem-icon">${icon('bell', 15)}</span>
        <div><strong>${U.esc(r.item.title)}</strong><span>${U.esc(App.reminders.describe(r))}</span></div>
        <time>${new Date(r.fireAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: App.store.state.settings.clock !== '24' })}</time>
      </li>`).join('')}</ul>`;
  }

  view.render = function () {
    const st = App.store.state;
    const today = U.todayKey();
    const key = view.date || today;
    const isToday = key === today;
    const tasks = S.tasksOn(key);
    const late = isToday ? S.overdue(today) : [];
    const events = S.eventsOn(key);
    const done = tasks.filter((t) => S.isDone(t, key)).length;
    const pct = tasks.length ? (done / tasks.length) * 100 : 0;
    const day = st.days[key] || {};
    const habitsDone = st.habits.filter((h) => S.habitDone(h, key)).length;
    const name = st.settings.name ? `, ${U.esc(st.settings.name)}` : '';
    const heading = isToday ? `${U.greeting()}${name}` : U.relDay(key);
    const remaining = tasks.length - done;

    const taskList = tasks.length
      ? tasks.map((t) => C.taskItem(t, key, { showSubs: true })).join('')
      : C.empty('check', isToday ? 'No tasks for today' : 'No tasks for this day', 'Type below to add your first task.');

    return `
      <div class="today">
        <section class="card hero">
          <div class="hero-main">
            <div class="day-nav">
              <button type="button" class="icon-btn" data-action="day-prev" aria-label="Previous day">${icon('left')}</button>
              <button type="button" class="btn ghost sm" data-action="day-today" ${isToday ? 'disabled' : ''}>Today</button>
              <button type="button" class="icon-btn" data-action="day-next" aria-label="Next day">${icon('right')}</button>
              <label class="date-jump" title="Jump to date">${icon('calendar', 16)}<input type="date" id="dayJump" value="${key}" aria-label="Jump to date"></label>
            </div>
            <h2>${heading}</h2>
            <p class="muted">${U.fmtDate(key, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <label class="focus-input">
              <span>${icon('target', 16)} Main focus</span>
              <input type="text" id="dayFocus" maxlength="140" value="${U.esc(day.focus || '')}" placeholder="What is the one thing that matters most ${isToday ? 'today' : 'this day'}?" autocomplete="off">
            </label>
          </div>
          <div class="hero-stats">
            ${C.progressRing(pct, 96, `${done}/${tasks.length} done`)}
            <ul class="stat-list">
              <li><strong>${remaining}</strong><span>tasks left</span></li>
              <li><strong>${events.length}</strong><span>events</span></li>
              <li><strong>${habitsDone}/${st.habits.length}</strong><span>habits</span></li>
              ${late.length ? `<li class="danger"><strong>${late.length}</strong><span>overdue</span></li>` : ''}
            </ul>
          </div>
        </section>

        <div class="today-cols">
          <div class="col">
            <section class="card">
              <div class="card-head">
                <h3>${icon('list')} Tasks</h3>
                <button type="button" class="btn ghost sm" data-action="new-task" data-date="${key}">${icon('plus', 14)}Add</button>
              </div>
              ${late.length ? `
                <div class="group-label danger">${icon('alert', 14)} Overdue <span>${late.length}</span></div>
                <div class="task-list">${late.map((t) => C.taskItem(t, t.date, { showDate: true })).join('')}</div>
                <div class="group-label">${icon('sun', 14)} ${isToday ? 'Today' : U.relDay(key)}</div>` : ''}
              <div class="task-list">${taskList}</div>
              <form class="quick-add" data-quick>
                <span>${icon('plus', 16)}</span>
                <input type="text" id="quickAdd" placeholder="Add a task… try “Gym at 6pm #health !high”" autocomplete="off" aria-label="Quick add task">
                <button type="submit" class="btn primary sm">Add</button>
              </form>
            </section>

            <section class="card">
              <div class="card-head"><h3>${icon('note')} Notes & reflection</h3><span class="muted sm" id="notesSaved"></span></div>
              <div class="mood" role="group" aria-label="How was your day?">
                <span class="muted sm">Mood</span>
                ${MOODS.map(([m, e]) => `<button type="button" class="mood-btn ${day.mood === m ? 'on' : ''}" data-action="mood" data-mood="${m}" aria-pressed="${day.mood === m}" title="${m}">${e}</button>`).join('')}
              </div>
              <textarea id="dayNotes" rows="5" placeholder="Thoughts, wins, lessons, gratitude…">${U.esc(day.notes || '')}</textarea>
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
              }).join('')}</div>` : C.empty('flame', 'No habits yet', 'Build routines that stick.', `<button class="btn ghost sm" data-action="new-habit">${icon('plus', 14)}Add habit</button>`)}
            </section>

            <section class="card">
              <div class="card-head"><h3>${icon('bell')} Upcoming reminders</h3></div>
              ${reminders()}
            </section>
          </div>
        </div>
      </div>`;
  };

  const saveNotes = U.debounce(() => {
    App.store.save({ silent: true });
    const el = document.getElementById('notesSaved');
    if (el) el.textContent = 'Saved';
  }, 500);

  view.onClick = function (e, a) {
    if (!a) return;
    const today = U.todayKey();
    const key = view.date || today;
    switch (a.dataset.action) {
      case 'day-prev': view.date = U.addDays(key, -1); App.render(); break;
      case 'day-next': view.date = U.addDays(key, 1); App.render(); break;
      case 'day-today': view.date = null; App.render(); break;
      case 'mood': {
        const d = App.store.day(key);
        d.mood = d.mood === a.dataset.mood ? null : a.dataset.mood;
        App.store.save();
        break;
      }
      default:
    }
  };

  view.onInput = function (e) {
    const key = view.date || U.todayKey();
    if (e.target.id === 'dayNotes') {
      App.store.day(key).notes = e.target.value;
      const el = document.getElementById('notesSaved');
      if (el) el.textContent = 'Saving…';
      saveNotes();
    } else if (e.target.id === 'dayFocus') {
      App.store.day(key).focus = e.target.value;
      saveNotes();
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
