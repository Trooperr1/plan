/* "My Day" — today's tasks and schedule. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);

  const view = { title: 'My Day', date: null };

  /* "Call mom at 5pm" → title + time. Also understands #category and !high. */
  function parseQuick(text) {
    const cats = App.store.state.categories;
    let time = null;
    let endTime = null;
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
    // Ranges: "5-7pm", "9:30am-11", "17:00-19:00", "کاتژمێر 5 تا 7 د.ن"
    const to12 = (h, ap) => (h % 12) + (/pm|د/i.test(ap) ? 12 : 0);
    title = title.replace(/\s(?:from\s+|کاتژمێر\s+|لە\s+)?(\d{1,2})(?::([0-5]\d))?\s?(am|pm|پ\.ن|د\.ن)?\s?(?:-|–|to|تا|بۆ)\s?(\d{1,2})(?::([0-5]\d))?\s?(am|pm|پ\.ن|د\.ن)?(?=\s)/i,
      (m, h1, m1, ap1, h2, m2, ap2) => {
        h1 = Number(h1);
        h2 = Number(h2);
        let a;
        let b;
        if (ap1 || ap2) {
          if (h1 < 1 || h1 > 12 || h2 < 1 || h2 > 12) return m;
          b = to12(h2, ap2 || ap1) * 60 + Number(m2 || 0);
          a = to12(h1, ap1 || ap2) * 60 + Number(m1 || 0);
          if (!ap1 && a >= b) a = to12(h1, 'am') * 60 + Number(m1 || 0); // "11-1pm" = 11 AM to 1 PM
        } else {
          if (!m1 && !m2) return m; // plain "5-7" could be anything; needs am/pm or minutes
          if (h1 > 23 || h2 > 23) return m;
          a = h1 * 60 + Number(m1 || 0);
          b = h2 * 60 + Number(m2 || 0);
        }
        if (b <= a) return m;
        time = U.fromMin(a);
        endTime = U.fromMin(b);
        return ' ';
      });
    // "5pm", "at 5:30 pm", "کاتژمێر 5 د.ن" (د.ن = PM, پ.ن = AM)
    if (!time) title = title.replace(/\s(?:at\s+|کاتژمێر\s+)?(\d{1,2})(?::([0-5]\d))?\s?(am|pm|پ\.ن|د\.ن)(?=\s)/i, (m, h, mi, ap) => {
      h = Number(h);
      if (h < 1 || h > 12) return m;
      h = (h % 12) + (/pm|د/i.test(ap) ? 12 : 0);
      time = `${U.pad(h)}:${mi || '00'}`;
      return ' ';
    });
    if (!time) {
      title = title.replace(/\s(?:at\s+|کاتژمێر\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m, h, mi) => {
        time = `${U.pad(Number(h))}:${mi}`;
        return ' ';
      });
    }
    return { title: title.replace(/\s+/g, ' ').trim(), time, endTime, priority, category };
  }

  function schedule(key, isToday) {
    const items = S.agenda(key);
    if (!items.length) {
      return C.empty('calendar', T('Nothing scheduled'), '',
        `<button class="btn ghost sm" data-action="new-event" data-date="${key}">${icon('plus', 14)}${T('Add event')}</button>`);
    }
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let nowPlaced = !isToday;
    const rows = [];
    const nowLine = `<li class="now-line" title="${T('Now')} · ${U.fmtTime(U.fromMin(nowMin))}"><span>${T('Now')}</span></li>`;
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
            <div class="agenda-time">${e.allDay ? T('All day') : `${U.fmtTime(e.start)}<small>${U.fmtTime(e.end)}</small>`}</div>
            <div class="agenda-bar"></div>
            <div class="agenda-body">
              <strong>${U.esc(e.title)}</strong>
              <span>${[e.location && U.esc(e.location), live && `<b class="live-tag">${T('Now')}</b>`].filter(Boolean).join(' · ')}</span>
            </div>
          </li>`);
      } else {
        const t = it.item;
        const done = S.isDone(t, key);
        rows.push(`
          <li class="agenda-item task ${done ? 'done' : ''} ${past && !done ? 'past' : ''}" style="--c:${U.esc(cat.color)}">
            <div class="agenda-time">${U.fmtTime(t.time)}${t.endTime ? `<small>${U.fmtTime(t.endTime)}</small>` : ''}</div>
            <div class="agenda-bar"></div>
            <div class="agenda-body" data-action="edit-task" data-id="${t.id}" role="button" tabindex="0">
              <strong>${U.esc(t.title)}</strong>
              <span>${T('Task')}${done ? ` · ${T('Done')}` : ''}</span>
            </div>
            <button type="button" class="check sm ${done ? 'on' : ''}" data-action="toggle-task" data-id="${t.id}" data-date="${key}" aria-label="${T('Done')}" aria-pressed="${done}">${icon('check', 12)}</button>
          </li>`);
      }
    });
    if (!nowPlaced) rows.push(nowLine);
    return `<ol class="agenda">${rows.join('')}</ol>`;
  }

  /* Free hours of the day; tap one to plan a task in it. */
  function freeTime(key) {
    if (key < U.todayKey()) return '';
    const slots = S.freeSlots(key, null, 7 * 60, 23 * 60);
    const range = (x) => `${U.fmtTime(U.fromMin(x.s))} – ${U.fmtTime(U.fromMin(x.e))}`;
    return `
      <div class="free-time">
        <span class="dp-label free">${icon('clock', 13)} ${T('Free time')}</span>
        ${slots.length ? slots.map((x) => `<button type="button" class="dp-chip free" data-action="new-task" data-date="${key}"
            data-time="${U.fromMin(x.s)}" data-end="${U.fromMin(Math.min(x.e, x.s + 60))}" title="${T('Add a task at this time')}">
            <b>${range(x)}</b> · ${U.fmtDuration((x.e - x.s) * 60000)}</button>`).join('')
          : `<span class="muted sm">${T('No free time left on this day.')}</span>`}
      </div>`;
  }

  /* "Now" and "Next" for today: what is happening and what comes after. */
  function nowNext() {
    const today = U.todayKey();
    const d = new Date();
    const now = d.getHours() * 60 + d.getMinutes();
    const items = S.busy(today).filter((b) => !(b.kind === 'task' && S.isDone(b.item, today)));
    const cur = items.filter((b) => b.s <= now && b.e > now);
    const next = items.find((b) => b.s > now);
    if (!cur.length && !next) return '';
    const edit = (b) => `data-action="${b.kind === 'task' ? 'edit-task' : 'edit-event'}" data-id="${b.item.id}" role="button" tabindex="0"`;
    return `
      <div class="now-next">
        ${cur.length ? `<div class="nn now" ${edit(cur[0])}><span class="nn-tag">${icon('zap', 13)} ${T('Now')}</span>
          <strong>${U.esc(cur[0].title)}</strong><span class="muted sm">${T('{time} left', { time: U.fmtDuration((cur[0].e - now) * 60000) })}</span></div>`
          : `<div class="nn free"><span class="nn-tag">${icon('check', 13)} ${T('Now')}</span><strong>${T('You are free')}</strong>${next ? `<span class="muted sm">${T('until {time}', { time: U.fmtTime(U.fromMin(next.s)) })}</span>` : ''}</div>`}
        ${next ? `<div class="nn next" ${edit(next)}><span class="nn-tag">${icon('right', 13)} ${T('Next')}</span>
          <strong>${U.esc(next.title)}</strong><span class="muted sm">${U.fmtTime(U.fromMin(next.s))} · ${T('in {time}', { time: U.fmtDuration((next.s - now) * 60000) })}</span></div>` : ''}
      </div>`;
  }

  function habits(key) {
    const st = App.store.state;
    if (!st.settings.showHabits) return '';
    return `
      <section class="card">
        <div class="card-head">
          <h3>${icon('flame')} ${T('Habits')}</h3>
          <a class="btn ghost sm" href="#/habits">${T('View all')}</a>
        </div>
        ${st.habits.length ? `<div class="habit-chips">${st.habits.map((h) => {
          const on = S.habitDone(h, key);
          const streak = S.streak(h);
          return `<button type="button" class="habit-chip ${on ? 'on' : ''}" style="--c:${U.esc(h.color)}" data-action="toggle-habit" data-id="${h.id}" data-date="${key}" aria-pressed="${on}">
            <span class="emoji">${U.esc(h.icon)}</span><span class="name">${U.esc(h.name)}</span>
            ${streak ? `<span class="streak">🔥${streak}</span>` : ''}<span class="tick">${icon('check', 12)}</span></button>`;
        }).join('')}</div>` : C.empty('flame', T('No habits yet'), '', `<button class="btn ghost sm" data-action="new-habit">${icon('plus', 14)}${T('Add habit')}</button>`)}
      </section>`;
  }

  /* Helpful one-tap messages at the top of the day. */
  function banners(key, isToday, tasks) {
    const st = App.store.state;
    const out = [];
    const day = st.days[key] || {};
    if (isToday && App.views.review.due()) {
      out.push(`
        <div class="banner review">
          <span class="banner-icon">📅</span>
          <div><strong>${T('Your Sunday review is ready')}</strong><span>${T('Take 5 minutes to see your week and plan what is next.')}</span></div>
          <div class="banner-actions">
            <button type="button" class="btn primary sm" data-action="open-review">${T('Open review')}</button>
            <button type="button" class="btn ghost sm" data-action="review-later">${T('Later')}</button>
          </div>
        </div>`);
    }
    const unfinished = tasks.filter((t) => !S.isRecurring(t) && !t.done);
    if (isToday && new Date().getHours() >= 18 && unfinished.length && !day.eveningDismissed) {
      out.push(`
        <div class="banner evening">
          <span class="banner-icon">🌙</span>
          <div><strong>${T('{n} tasks not done today', { n: unfinished.length })}</strong><span>${T('Move them to tomorrow so nothing gets lost.')}</span></div>
          <div class="banner-actions">
            <button type="button" class="btn primary sm" data-action="move-tomorrow" data-date="${key}">${T('Move to tomorrow')}</button>
            <button type="button" class="btn ghost sm" data-action="dismiss-evening" data-date="${key}">${T('Not now')}</button>
          </div>
        </div>`);
    }
    const bills = isToday ? App.money.dueSoon(2) : [];
    if (bills.length) {
      const one = bills.length === 1 ? bills[0] : null;
      const when = (x) => (x.days < 0 ? T('late by {n} days', { n: -x.days }) : x.days === 0 ? T('today') : x.days === 1 ? T('tomorrow') : T('in {n} days', { n: x.days }));
      out.push(`
        <div class="banner bills ${bills.some((x) => x.days < 0) ? 'late' : ''}">
          <span class="banner-icon">🧾</span>
          <div>${one
            ? `<strong>${T('{name} is due {when}', { name: U.esc(one.bill.name), when: when(one) })}</strong><span>${U.money(one.bill.amount)}</span>`
            : `<strong>${T('{n} bills are due soon', { n: bills.length })}</strong><span>${bills.map((x) => U.esc(x.bill.name)).join(App.i18n.lang() === 'ckb' ? '، ' : ', ')}</span>`}</div>
          <div class="banner-actions">
            ${one ? `<button type="button" class="btn primary sm" data-action="pay-bill" data-id="${one.bill.id}" data-month="${one.due.slice(0, 7)}">${T('Pay')}</button>` : ''}
            <a class="btn ${one ? 'ghost' : 'primary'} sm" href="#/money">${T('Open money')}</a>
          </div>
        </div>`);
    }
    if (App.safety.backupDue()) {
      const last = st.meta.lastBackup;
      out.push(`
        <div class="banner backup">
          <span class="banner-icon">💾</span>
          <div><strong>${last ? T('Last backup: {when}', { when: U.agoDays(last) }) : T('You have no backup yet')}</strong><span>${T('Download a backup so your plans are safe if this phone is lost or reset.')}</span></div>
          <div class="banner-actions">
            <button type="button" class="btn primary sm" data-action="backup-now">${T('Back up now')}</button>
            <button type="button" class="btn ghost sm" data-action="backup-later">${T('Later')}</button>
          </div>
        </div>`);
    } else if (App.safety.showInstallTip() && window.matchMedia('(max-width: 860px)').matches) {
      out.push(`
        <div class="banner install">
          <span class="banner-icon">📲</span>
          <div><strong>${T('Add this app to your Home screen')}</strong><span>${T('It opens faster, works offline and keeps your data safe.')}</span></div>
          <div class="banner-actions">
            ${App.safety.installPrompt ? `<button type="button" class="btn primary sm" data-action="install-app">${T('Install')}</button>` : `<a class="btn primary sm" href="#/settings">${T('How?')}</a>`}
            <button type="button" class="btn ghost sm" data-action="dismiss-install">${T('Close')}</button>
          </div>
        </div>`);
    }
    return out.join('');
  }

  /* The goals today's work leads to. */
  function workingTowards(tasks) {
    const st = App.store.state;
    const today = U.todayKey();
    const linked = new Set(tasks.map((t) => t.goalId).filter(Boolean));
    const goals = st.goals
      .filter((g) => !g.achieved && S.goalProgress(g) < 100 && S.goalEnd(g) >= today && S.goalStart(g) <= today)
      .sort((a, b) => (linked.has(b.id) - linked.has(a.id)) || S.goalEnd(a).localeCompare(S.goalEnd(b)))
      .slice(0, 3);
    if (!goals.length) return '';
    return `
      <section class="towards">
        <span class="towards-label">${icon('flag', 14)} ${T('Working towards')}</span>
        <div class="towards-list">${goals.map((g) => {
          const c = App.store.category(g.category).color;
          const p = S.goalProgress(g);
          return `<button type="button" class="towards-goal" style="--c:${U.esc(c)}" data-action="open-goal">
            <strong>${U.esc(g.title)}</strong>
            <span class="bar"><span style="width:${p}%"></span></span>
            <small>${p}% · ${T('{n} days left', { n: S.goalDaysLeft(g) })}</small></button>`;
        }).join('')}</div>
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
      : C.empty('check', T('No tasks yet'), T('Type a task below and press Add.'));

    return `
      <div class="today">
        <section class="card hero">
          <div class="hero-main">
            <div class="day-nav">
              <button type="button" class="icon-btn" data-action="day-prev" aria-label="${T('Previous day')}">${icon('left')}</button>
              <button type="button" class="btn ghost sm" data-action="day-today" ${isToday ? 'disabled' : ''}>${T('Today')}</button>
              <button type="button" class="icon-btn" data-action="day-next" aria-label="${T('Next day')}">${icon('right')}</button>
              <label class="date-jump" title="${T('Pick a date')}">${icon('calendar', 16)}<input type="date" id="dayJump" value="${key}" aria-label="${T('Pick a date')}"></label>
              <a class="btn ghost sm review-link" href="#/review">${icon('star', 14)}${T('Week review')}</a>
            </div>
            <h2>${heading}</h2>
            <p class="muted">${U.fmtDate(key, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            ${isToday ? nowNext() : ''}
          </div>
          ${tasks.length ? `<div class="hero-stats">${C.progressRing(pct, 88, T('{done} of {total}', { done, total: tasks.length }))}</div>` : ''}
        </section>

        ${banners(key, isToday, tasks)}
        ${workingTowards(tasks)}

        <div class="today-cols">
          <div class="col">
            <section class="card">
              <div class="card-head"><h3>${icon('list')} ${T('Tasks')}</h3></div>
              ${late.length ? `
                <div class="group-label danger">${icon('alert', 14)} ${T('Overdue')} <span>${late.length}</span>
                  <button type="button" class="btn ghost sm label-btn" data-action="move-overdue">${T('Move all to today')}</button></div>
                <div class="task-list">${late.map((t) => C.taskItem(t, t.date, { showDate: true })).join('')}</div>
                <div class="group-label">${icon('sun', 14)} ${isToday ? T('Today') : U.relDay(key)}</div>` : ''}
              <div class="task-list">${taskList}</div>
              <form class="quick-add" data-quick>
                <span>${icon('plus', 16)}</span>
                <input type="text" id="quickAdd" placeholder="${T('Add a task…')}" autocomplete="off" aria-label="${T('Add a task…')}">
                <button type="submit" class="btn primary sm">${T('Add')}</button>
              </form>
            </section>
          </div>

          <div class="col">
            <section class="card">
              <div class="card-head">
                <h3>${icon('clock')} ${T('Schedule')}</h3>
                <button type="button" class="btn ghost sm" data-action="new-event" data-date="${key}">${icon('plus', 14)}${T('Event')}</button>
              </div>
              ${schedule(key, isToday)}
              ${freeTime(key)}
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
      endTime: parsed.endTime,
      priority: parsed.priority,
      category: parsed.category || App.store.defaultCategory(),
      reminder: parsed.time ? st.settings.defaultReminder : null,
    }));
    const when = parsed.time ? `${U.fmtTime(parsed.time)}${parsed.endTime ? ` – ${U.fmtTime(parsed.endTime)}` : ''}` : '';
    App.ui.toast(parsed.time ? T('Added “{name}” at {time}', { name: parsed.title, time: when }) : T('Added “{name}”', { name: parsed.title }));
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
