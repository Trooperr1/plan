/* Create / edit dialogs for tasks, events, habits and yearly goals. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const esc = U.esc;
  const icon = (n, s) => App.icon(n, s);
  const opts = (list, sel) => App.c.options(list, sel);
  const store = () => App.store;
  const T = (x, v) => App.t(x, v);

  const catOptions = (sel) => opts(store().state.categories.map((c) => [c.id, T(c.name)]), sel);
  const repeatOptions = (sel) => opts(Object.entries(S.REPEATS).map(([k, v]) => [k, T(v)]), sel || 'none');
  const reminderOptions = (sel) => opts(S.REMINDERS.map(([k, v]) => [k, T(v)]), sel);
  const monthOptions = (sel) => opts(U.MONTHS.map((m, i) => [i, m]), sel);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function footer(formId, isNew) {
    return `
      ${!isNew ? `<button type="button" class="btn ghost danger-text" data-delete>${icon('trash', 16)}<span>${T('Delete')}</span></button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>${T('Cancel')}</button>
      <button type="submit" class="btn primary" form="${formId}">${isNew ? T('Create') : T('Save')}</button>`;
  }

  function goalPicker(selected) {
    const goals = store().state.goals.filter((g) => !g.achieved || g.id === selected).sort((a, b) => a.end.localeCompare(b.end));
    if (!goals.length) return '';
    return `<label class="field"><span>${T('Goal')} <em>(${T('optional')})</em></span>
      <select name="goalId">${opts([[null, T('No goal')], ...goals.map((g) => [g.id, `${g.title} (${S.goalRange(g)})`])], selected)}</select></label>`;
  }

  function phoneButton() {
    return `<button type="button" class="btn ghost phone-cal" data-ics>${icon('bell', 16)}${T('Add to phone calendar')} <em>${T('rings even when this app is closed')}</em></button>`;
  }

  /* "Your day": busy and free hours for the chosen date, a clash warning, and free times to tap. */
  function dayPlan(box, o, onPick) {
    if (!o.date) {
      box.innerHTML = '';
      return;
    }
    const busy = S.busy(o.date, o.skipId);
    const s = o.start ? U.toMin(o.start) : null;
    const e = s == null ? null : o.end && U.toMin(o.end) > s ? U.toMin(o.end) : s + 30;
    let from = 6 * 60;
    busy.forEach((b) => { from = Math.min(from, Math.floor(b.s / 60) * 60); });
    if (s != null) from = Math.min(from, Math.floor(s / 60) * 60);
    const to = 24 * 60;
    const pos = (m) => (((m - from) / (to - from)) * 100).toFixed(2);
    const wid = (a, b) => (((Math.min(b, to) - a) / (to - from)) * 100).toFixed(2);
    const range = (a, b) => `${U.fmtTime(U.fromMin(a))} – ${U.fmtTime(U.fromMin(Math.min(b, 1439)))}`;
    const clash = s == null ? [] : busy.filter((b) => b.s < e && b.e > s);
    const free = S.freeSlots(o.date, o.skipId, from, to);
    const ticks = [];
    for (let h = Math.ceil(from / 180) * 3; h <= 24; h += 3) ticks.push(h);
    box.innerHTML = `
      <div class="dp-head"><strong>${icon('calendar', 15)} ${T('Your day')} · ${U.esc(U.relDay(o.date))}</strong>
        <span class="muted sm">${busy.length ? T('{n} busy', { n: busy.length }) : ''}</span></div>
      <div class="dp-bar" aria-hidden="true">
        ${ticks.map((h) => `<i class="dp-tick" style="--x:${pos(h * 60)}%"><span>${h === 24 ? '' : U.fmtHour(h)}</span></i>`).join('')}
        ${busy.map((b) => `<b class="dp-busy" style="--x:${pos(b.s)}%;width:${wid(b.s, b.e)}%;--c:${U.esc(App.store.category(b.item.category).color)}" title="${U.esc(b.title)} · ${range(b.s, b.e)}"></b>`).join('')}
        ${s != null ? `<b class="dp-new ${clash.length ? 'clash' : ''}" style="--x:${pos(s)}%;width:${wid(s, e)}%"></b>` : ''}
      </div>
      ${s == null ? `<p class="dp-hint">${T('Pick a free time below, or type the hours above.')}</p>`
        : clash.length ? `<p class="dp-warn">${icon('alert', 15)} ${T('This time is busy: {name} ({time})', { name: U.esc(clash[0].title), time: range(clash[0].s, clash[0].e) })}${clash.length > 1 ? ` +${clash.length - 1}` : ''}</p>`
          : `<p class="dp-ok">${icon('check', 15)} ${T('This time is free')} · ${range(s, e)}</p>`}
      ${busy.length ? `<div class="dp-row"><span class="dp-label busy">${T('Busy')}</span>
        ${busy.map((b) => `<span class="dp-chip busy" style="--c:${U.esc(App.store.category(b.item.category).color)}"><b>${range(b.s, b.e)}</b> ${U.esc(b.title)}</span>`).join('')}</div>` : ''}
      <div class="dp-row"><span class="dp-label free">${T('Free')}</span>
        ${free.length ? free.map((x) => `<button type="button" class="dp-chip free" data-s="${x.s}" data-e="${x.e}"><b>${range(x.s, x.e)}</b> · ${U.fmtDuration((x.e - x.s) * 60000)}</button>`).join('')
          : `<span class="muted sm">${T('No free time left on this day.')}</span>`}</div>
      ${!busy.length ? `<p class="dp-ok">🎉 ${T('Your whole day is free')}</p>` : ''}`;
    box.querySelectorAll('.dp-chip.free').forEach((btn) => btn.addEventListener('click', () => {
      const a = Number(btn.dataset.s);
      const dur = s != null ? e - s : 60;
      onPick(U.fromMin(a), U.fromMin(Math.min(Number(btn.dataset.e), a + dur, 1439)));
    }));
  }

  /* "How long?" buttons: set the length, or jump to the first free time that fits. */
  const DURATIONS = [15, 30, 60, 120];
  function durRow() {
    return `<div class="dur-row"><span class="dp-label">${T('How long?')}</span>
      ${DURATIONS.map((d) => `<button type="button" class="dur-chip" data-dur="${d}">${U.fmtDuration(d * 60000)}</button>`).join('')}
      <button type="button" class="dur-chip first" data-first>${icon('zap', 13)}${T('First free time')}</button></div>`;
  }
  function wireDur(el, read, apply, skipId) {
    const row = el.querySelector('.dur-row');
    const mark = () => {
      const { start, end } = read();
      const len = start && end ? U.toMin(end) - U.toMin(start) : null;
      row.querySelectorAll('[data-dur]').forEach((b) => b.classList.toggle('on', Number(b.dataset.dur) === len));
    };
    const firstFree = (date, len) => S.freeSlots(date, skipId, 6 * 60, 24 * 60).find((x) => x.e - x.s >= len);
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const { date, start, end } = read();
      if (!date) return App.ui.toast(T('Please choose a date.'), { type: 'danger' });
      const cur = start && end && U.toMin(end) > U.toMin(start) ? U.toMin(end) - U.toMin(start) : 60;
      const len = btn.dataset.dur ? Number(btn.dataset.dur) : cur;
      let s = start && !btn.hasAttribute('data-first') ? U.toMin(start) : null;
      if (s == null) {
        const slot = firstFree(date, len);
        if (!slot) return App.ui.toast(T('No free time left on this day.'), { type: 'danger' });
        s = slot.s;
      }
      apply(U.fromMin(s), U.fromMin(Math.min(s + len, 1439)));
      mark();
    });
    el.querySelector('form').addEventListener('change', mark);
    mark();
    return mark;
  }

  function fieldError(form, name, msg) {
    const input = form.elements[name];
    input.classList.add('invalid');
    input.focus();
    App.ui.toast(msg, { type: 'danger' });
    input.addEventListener('input', () => input.classList.remove('invalid'), { once: true });
  }

  /* Small editable list (checklist steps / milestones). */
  function listEditor(container, items, rowHtml, blank) {
    const render = () => {
      container.innerHTML = items.length
        ? items.map((it, i) => `<div class="list-row" data-i="${i}">${rowHtml(it)}<button type="button" class="icon-btn sm" data-rm="${i}" aria-label="${T('Remove')}">${icon('x', 14)}</button></div>`).join('')
        : `<p class="hint">${T('Nothing added yet.')}</p>`;
    };
    const sync = () => {
      container.querySelectorAll('.list-row').forEach((row) => {
        const it = items[Number(row.dataset.i)];
        row.querySelectorAll('[data-k]').forEach((inp) => {
          it[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value;
        });
      });
    };
    container.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (!rm) return;
      sync();
      items.splice(Number(rm.dataset.rm), 1);
      render();
    });
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input[type="text"]')) {
        e.preventDefault();
        add();
      }
    });
    function add() {
      sync();
      items.push(blank(items));
      render();
      const inputs = container.querySelectorAll('input[type="text"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }
    render();
    return { add, collect: () => (sync(), items) };
  }

  /* ---------------- Task ---------------- */
  function task(existing, preset) {
    const isNew = !existing;
    const t = isNew ? store().newTask(preset) : clone(existing);
    const id = 'taskForm';
    const m = App.ui.modal({
      title: isNew ? T('New task') : T('Edit task'),
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>${T('Title')}</span>
            <input name="title" type="text" maxlength="200" value="${esc(t.title)}" placeholder="${T('What do you need to do?')}" autocomplete="off" autofocus></label>
          <label class="field"><span>${T('Date')}</span><input type="date" name="date" value="${t.date || ''}"></label>
          <div class="row-2 time-pair">
            <label class="field"><span>${T('From')}</span><input type="time" name="time" value="${t.time || ''}"></label>
            <label class="field"><span>${T('To')}</span><input type="time" name="endTime" value="${t.endTime || ''}"></label>
          </div>
          ${durRow()}
          <div class="day-plan" data-dayplan></div>
          <div class="row-2">
            <label class="field"><span>${T('Reminder')}</span><select name="reminder">${reminderOptions(t.reminder)}</select></label>
            <label class="field"><span>${T('Repeat')}</span><select name="repeat">${repeatOptions(t.repeat)}</select></label>
          </div>
          <p class="hint" data-reminder-hint hidden>${icon('alert', 13)} ${T('Pick a date and time so the reminder knows when to ring.')}</p>
          ${goalPicker(t.goalId)}
          <details class="more" ${!isNew && (t.subtasks.length || t.notes || t.priority !== 'medium') ? 'open' : ''}>
            <summary>${T('More options')}</summary>
            <div class="more-body">
              <div class="field"><span>${T('Priority')}</span>
                <div class="segmented" role="radiogroup">
                  ${['low', 'medium', 'high'].map((p) => `
                    <label class="seg prio-${p}"><input type="radio" name="priority" value="${p}" ${t.priority === p ? 'checked' : ''}><span>${T(S.PRIORITIES[p])}</span></label>`).join('')}
                </div>
              </div>
              <label class="field"><span>${T('Category')}</span><select name="category">${catOptions(t.category)}</select></label>
              <div class="field"><span>${T('Checklist')}</span>
                <div class="list-editor" data-subs></div>
                <button type="button" class="btn ghost sm add-row" data-add-sub>${icon('plus', 14)}${T('Add step')}</button>
              </div>
              <label class="field"><span>${T('Notes')}</span><textarea name="notes" rows="3" placeholder="${T('Details…')}">${esc(t.notes)}</textarea></label>
            </div>
          </details>
          ${phoneButton()}
          ${!isNew ? `<button type="button" class="btn ghost phone-cal" data-copy>${icon('repeat', 16)}${T('Copy to tomorrow')}</button>` : ''}
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const subs = listEditor(el.querySelector('[data-subs]'), t.subtasks.map((s) => ({ ...s })),
          (s) => `<input type="checkbox" data-k="done" ${s.done ? 'checked' : ''} aria-label="${T('Done')}"><input type="text" data-k="title" value="${esc(s.title)}" placeholder="${T('Step')}">`,
          () => ({ id: U.uid(), title: '', done: false }));
        el.querySelector('[data-add-sub]').addEventListener('click', subs.add);

        // Your day: redraw when the date or hours change; keep the length when the start moves.
        const plan = el.querySelector('[data-dayplan]');
        let lastDur = t.time && t.endTime ? U.toMin(t.endTime) - U.toMin(t.time) : 60;
        const drawPlan = () => dayPlan(plan, { date: form.elements.date.value, start: form.elements.time.value, end: form.elements.endTime.value, skipId: t.id },
          (a, b) => {
            form.elements.time.value = a;
            form.elements.endTime.value = b;
            lastDur = U.toMin(b) - U.toMin(a);
            form.elements.time.dispatchEvent(new Event('change'));
          });
        form.elements.time.addEventListener('change', () => {
          const f = form.elements;
          // Moving the start moves the end too, so the task keeps its length.
          if (f.time.value) f.endTime.value = U.fromMin(Math.min(U.toMin(f.time.value) + lastDur, 1439));
          if (!f.time.value) f.endTime.value = '';
          drawPlan();
        });
        form.elements.endTime.addEventListener('change', () => {
          const f = form.elements;
          if (f.time.value && f.endTime.value && U.toMin(f.endTime.value) > U.toMin(f.time.value)) lastDur = U.toMin(f.endTime.value) - U.toMin(f.time.value);
          drawPlan();
        });
        form.elements.date.addEventListener('change', drawPlan);
        drawPlan();
        wireDur(el, () => ({ date: form.elements.date.value, start: form.elements.time.value, end: form.elements.endTime.value }), (a, b) => {
          form.elements.time.value = a;
          form.elements.endTime.value = b;
          lastDur = U.toMin(b) - U.toMin(a);
          form.elements.time.dispatchEvent(new Event('change'));
        }, t.id);
        const copy = el.querySelector('[data-copy]');
        if (copy) copy.addEventListener('click', () => {
          const c = clone(existing);
          Object.assign(c, {
            id: U.uid(), date: U.addDays(U.todayKey(), 1), repeat: 'none', done: false, completedAt: null, doneDates: {},
            createdAt: Date.now(), subtasks: (c.subtasks || []).map((x) => ({ ...x, id: U.uid(), done: false })),
          });
          store().upsert('tasks', c);
          App.ui.toast(T('Copied to tomorrow'), { icon: 'repeat' });
          m.close();
        });

        const hint = el.querySelector('[data-reminder-hint]');
        const updateHint = () => {
          hint.hidden = !(form.elements.reminder.value !== '' && (!form.elements.time.value || !form.elements.date.value));
        };
        form.elements.time.addEventListener('change', () => {
          if (isNew && form.elements.time.value && form.elements.reminder.value === '') {
            form.elements.reminder.value = String(store().state.settings.defaultReminder);
          }
          updateHint();
        });
        form.elements.reminder.addEventListener('change', updateHint);
        form.elements.date.addEventListener('change', updateHint);
        updateHint();

        const wasRecurring = S.isRecurring(t);
        // Copy the form into the task; returns false when the title is missing.
        const collect = () => {
          const f = form.elements;
          const title = f.title.value.trim();
          if (!title) {
            fieldError(form, 'title', T('Please give the task a title.'));
            return false;
          }
          t.title = title;
          t.date = f.date.value || null;
          t.time = f.time.value || null;
          t.endTime = t.time && f.endTime.value ? f.endTime.value : null;
          if (t.endTime && U.toMin(t.endTime) <= U.toMin(t.time)) {
            fieldError(form, 'endTime', T('The end time must be after the start time.'));
            return false;
          }
          t.priority = form.querySelector('input[name="priority"]:checked').value;
          t.category = f.category.value;
          t.repeat = f.repeat.value;
          if (S.isRecurring(t) && !t.date) t.date = U.todayKey();
          t.reminder = f.reminder.value === '' ? null : Number(f.reminder.value);
          t.notes = f.notes.value.trim();
          t.subtasks = subs.collect().filter((s) => s.title.trim()).map((s) => ({ id: s.id, title: s.title.trim(), done: !!s.done }));
          t.goalId = f.goalId ? f.goalId.value || null : t.goalId;
          if (wasRecurring && !S.isRecurring(t)) t.done = false;
          return true;
        };
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!collect()) return;
          store().upsert('tasks', t);
          const saved = clone(t);
          App.ui.toast(isNew ? T('Task created') : T('Task saved'), isNew && t.time ? { action: { label: T('Add to phone calendar'), fn: () => App.ics.task(saved) }, duration: 6000 } : {});
          m.close();
        });
        el.querySelector('[data-ics]').addEventListener('click', () => { if (collect()) App.ics.task(t); });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteTask(t.id); });
      },
    });
  }

  /* ---------------- Event ---------------- */
  function event(existing, preset) {
    const isNew = !existing;
    const ev = isNew ? store().newEvent(preset) : clone(existing);
    const id = 'eventForm';
    const m = App.ui.modal({
      title: isNew ? T('New event') : T('Edit event'),
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>${T('Title')}</span>
            <input name="title" type="text" maxlength="200" value="${esc(ev.title)}" placeholder="${T('Meeting, class, appointment…')}" autocomplete="off" autofocus></label>
          <label class="field"><span>${T('Date')}</span><input type="date" name="date" value="${ev.date || U.todayKey()}" required></label>
          <div class="row-2" data-times>
            <label class="field"><span>${T('Starts')}</span><input type="time" name="start" value="${ev.start || '09:00'}"></label>
            <label class="field"><span>${T('Ends')}</span><input type="time" name="end" value="${ev.end || '10:00'}"></label>
          </div>
          ${durRow()}
          <div class="day-plan" data-dayplan></div>
          <div class="row-2">
            <label class="field" data-reminder><span>${T('Reminder')}</span><select name="reminder">${reminderOptions(ev.reminder)}</select></label>
            <label class="field"><span>${T('Repeat')}</span><select name="repeat">${repeatOptions(ev.repeat)}</select></label>
          </div>
          <details class="more" ${!isNew && (ev.allDay || ev.location || ev.notes) ? 'open' : ''}>
            <summary>${T('More options')}</summary>
            <div class="more-body">
              <label class="field switch-field"><span>${T('All day')}</span>
                <span class="switch"><input type="checkbox" name="allDay" ${ev.allDay ? 'checked' : ''}><i></i></span></label>
              <label class="field"><span>${T('Category')}</span><select name="category">${catOptions(ev.category)}</select></label>
              <label class="field"><span>${T('Location')}</span><input type="text" name="location" value="${esc(ev.location)}" placeholder="${T('Where?')}" autocomplete="off"></label>
              <label class="field"><span>${T('Notes')}</span><textarea name="notes" rows="3" placeholder="${T('Details…')}">${esc(ev.notes)}</textarea></label>
            </div>
          </details>
          ${phoneButton()}
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const f = form.elements;
        const plan = el.querySelector('[data-dayplan]');
        const drawPlan = () => dayPlan(plan, { date: f.date.value, start: f.start.value, end: f.end.value, skipId: ev.id }, (a, b) => {
          f.start.value = a;
          f.end.value = b;
          ev.start = a;
          ev.end = b;
          drawPlan();
        });
        f.date.addEventListener('change', drawPlan);
        f.end.addEventListener('change', drawPlan);
        const syncAllDay = () => {
          plan.hidden = f.allDay.checked;
          el.querySelector('.dur-row').hidden = f.allDay.checked;
          el.querySelector('[data-times]').hidden = f.allDay.checked;
          el.querySelector('[data-reminder]').hidden = f.allDay.checked;
        };
        f.allDay.addEventListener('change', syncAllDay);
        f.start.addEventListener('change', () => {
          // Keep the same duration when the start time moves.
          const dur = (U.toMin(ev.end) ?? 600) - (U.toMin(ev.start) ?? 540);
          if (f.start.value) f.end.value = U.fromMin(U.toMin(f.start.value) + Math.max(15, dur));
          ev.start = f.start.value;
          ev.end = f.end.value;
          drawPlan();
        });
        f.end.addEventListener('change', () => { ev.end = f.end.value; });
        syncAllDay();
        drawPlan();
        wireDur(el, () => ({ date: f.date.value, start: f.start.value, end: f.end.value }), (a, b) => {
          f.start.value = a;
          f.end.value = b;
          ev.start = a;
          ev.end = b;
          drawPlan();
        }, ev.id);

        const collect = () => {
          const title = f.title.value.trim();
          if (!title) return fieldError(form, 'title', T('Please give the event a title.')), false;
          if (!f.date.value) return fieldError(form, 'date', T('Please choose a date.')), false;
          ev.title = title;
          ev.date = f.date.value;
          ev.allDay = f.allDay.checked;
          ev.start = f.start.value || '09:00';
          ev.end = f.end.value || U.fromMin(U.toMin(ev.start) + 60);
          if (!ev.allDay && U.toMin(ev.end) <= U.toMin(ev.start)) {
            return fieldError(form, 'end', T('The end time must be after the start time.')), false;
          }
          ev.category = f.category.value;
          ev.repeat = f.repeat.value;
          ev.reminder = f.reminder.value === '' ? null : Number(f.reminder.value);
          ev.location = f.location.value.trim();
          ev.notes = f.notes.value.trim();
          return true;
        };
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!collect()) return;
          store().upsert('events', ev);
          const saved = clone(ev);
          App.ui.toast(isNew ? T('Event created') : T('Event saved'), isNew ? { action: { label: T('Add to phone calendar'), fn: () => App.ics.event(saved) }, duration: 6000 } : {});
          m.close();
        });
        el.querySelector('[data-ics]').addEventListener('click', () => { if (collect()) App.ics.event(ev); });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteEvent(ev.id); });
      },
    });
  }

  /* ---------------- Habit ---------------- */
  const EMOJIS = ['⭐', '🏃', '📚', '💧', '😴', '🧘', '🥗', '💪', '🙏', '✍️', '🎯', '💰', '🧹', '📵', '🚶', '🎸'];
  const COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6'];

  function habit(existing) {
    const isNew = !existing;
    const h = isNew ? store().newHabit() : clone(existing);
    const id = 'habitForm';
    const m = App.ui.modal({
      title: isNew ? T('New habit') : T('Edit habit'),
      size: 'sm',
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>${T('Habit')}</span>
            <input name="name" type="text" maxlength="80" value="${esc(h.name)}" placeholder="${T('e.g. Exercise 30 min')}" autocomplete="off" autofocus></label>
          <div class="field"><span>${T('Icon')}</span>
            <div class="emoji-pick">${EMOJIS.map((e) => `<label><input type="radio" name="icon" value="${e}" ${h.icon === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>
          </div>
          <div class="field"><span>${T('Color')}</span>
            <div class="color-pick">${COLORS.map((c) => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${h.color === c ? 'checked' : ''} aria-label="${c}"><span></span></label>`).join('')}</div>
          </div>
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        if (!form.querySelector('input[name="icon"]:checked')) form.querySelector('input[name="icon"]').checked = true;
        if (!form.querySelector('input[name="color"]:checked')) form.querySelector('input[name="color"]').checked = true;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = form.elements.name.value.trim();
          if (!name) return fieldError(form, 'name', T('Please name the habit.'));
          h.name = name;
          h.icon = form.querySelector('input[name="icon"]:checked').value;
          h.color = form.querySelector('input[name="color"]:checked').value;
          store().upsert('habits', h);
          App.ui.toast(isNew ? T('Habit added') : T('Habit saved'));
          m.close();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteHabit(h.id); });
      },
    });
  }

  /* ---------------- Goal ---------------- */
  const MK = /^(\d{4})-(\d{2})$/;
  const mkAdd = (mk, n) => {
    const [, y, mo] = mk.match(MK);
    const d = new Date(Number(y), Number(mo) - 1 + n, 1);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
  };
  /* Month + year pickers, e.g. [August] [2026]. */
  function monthYear(name, mk) {
    const [, y, mo] = mk.match(MK);
    const now = new Date().getFullYear();
    const years = [];
    for (let i = Math.min(now - 2, Number(y)); i <= Math.max(now + 15, Number(y)); i++) years.push([i, String(i)]);
    return `<span class="month-year">
      <select name="${name}M" aria-label="${T('Month')}">${monthOptions(Number(mo) - 1)}</select>
      <select name="${name}Y" aria-label="${T('Year')}">${opts(years, Number(y))}</select></span>`;
  }
  const LENGTHS = [[3, '3 months'], [6, '6 months'], [12, '1 year'], [24, '2 years']];

  function goal(existing, preset) {
    const isNew = !existing;
    const g = isNew ? store().newGoal(preset) : clone(existing);
    const id = 'goalForm';
    const m = App.ui.modal({
      title: isNew ? T('New goal') : T('Edit goal'),
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>${T('Goal')}</span>
            <input name="title" type="text" maxlength="120" value="${esc(g.title)}" placeholder="${T('e.g. Build my garage')}" autocomplete="off" autofocus></label>
          <div class="row-2">
            <div class="field"><span>${T('Starts')}</span>${monthYear('start', g.start)}</div>
            <div class="field"><span>${T('Ends')}</span>${monthYear('end', g.end)}</div>
          </div>
          <div class="dur-row goal-len"><span class="dp-label">${T('How long?')}</span>
            ${LENGTHS.map(([n, label]) => `<button type="button" class="dur-chip" data-len="${n}">${T(label)}</button>`).join('')}</div>
          <p class="hint goal-span" data-span></p>
          <label class="field"><span>${T('Money needed')} <em>(${T('optional')})</em></span>
            <input type="number" name="target" min="0" step="any" inputmode="decimal" value="${g.target || ''}" placeholder="${store().state.settings.currency ? esc(store().state.settings.currency) + ' ' : ''}${T('e.g.')} 500000"></label>
          <div class="field"><span>${T('Steps')} <em>(${T('optional')})</em></span>
            <div class="list-editor" data-ms></div>
            <button type="button" class="btn ghost sm add-row" data-add-ms>${icon('plus', 14)}${T('Add step')}</button>
          </div>
          <details class="more" ${!isNew && (g.notes || g.progress) ? 'open' : ''}>
            <summary>${T('More options')}</summary>
            <div class="more-body">
              <label class="field" data-progress-field><span>${T('Progress')} <output data-out>${g.progress}%</output></span>
                <input type="range" name="progress" min="0" max="100" step="5" value="${g.progress}"></label>
              <p class="hint" data-progress-auto>${T('Progress fills by itself as you tick off steps.')}</p>
              <label class="field"><span>${T('Category')}</span><select name="category">${catOptions(g.category)}</select></label>
              <label class="field"><span>${T('Notes')}</span><textarea name="notes" rows="3" placeholder="${T('Why it matters, your plan…')}">${esc(g.notes)}</textarea></label>
            </div>
          </details>
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const f = form.elements;
        const read = (name) => `${f[`${name}Y`].value}-${U.pad(Number(f[`${name}M`].value) + 1)}`;
        const write = (name, mk) => {
          const [, y, mo] = mk.match(MK);
          if (![...f[`${name}Y`].options].some((o) => o.value === String(Number(y)))) f[`${name}Y`].add(new Option(String(Number(y)), String(Number(y))));
          f[`${name}Y`].value = String(Number(y));
          f[`${name}M`].value = String(Number(mo) - 1);
        };
        // Show the length ("1 year 1 month") and mark the matching quick button.
        const span = () => {
          // "Aug 2026 → Aug 2027" is 1 year: count the months between start and end.
          const diff = S.monthNum(read('end')) - S.monthNum(read('start'));
          const months = Math.max(diff, 1);
          const box = el.querySelector('[data-span]');
          if (diff < 0) {
            box.textContent = T('The end must be after the start.');
            box.classList.add('bad');
          } else {
            const y = Math.floor(months / 12);
            const mo = months % 12;
            box.textContent = `${T('Length')}: ${[y ? T(y === 1 ? '1 year' : '{n} years', { n: y }) : '', mo ? T(mo === 1 ? '1 month' : '{n} months', { n: mo }) : ''].filter(Boolean).join(' + ')}`;
            box.classList.remove('bad');
          }
          el.querySelectorAll('[data-len]').forEach((b) => b.classList.toggle('on', Number(b.dataset.len) === diff));
        };
        ['startM', 'startY', 'endM', 'endY'].forEach((n) => f[n].addEventListener('change', span));
        el.querySelectorAll('[data-len]').forEach((b) => b.addEventListener('click', () => {
          write('end', mkAdd(read('start'), Number(b.dataset.len)));
          span();
        }));
        span();

        f.progress.addEventListener('input', () => { el.querySelector('[data-out]').textContent = `${f.progress.value}%`; });
        const msEd = listEditor(el.querySelector('[data-ms]'), g.milestones.map((x) => ({ ...x })),
          (x) => `<input type="checkbox" data-k="done" ${x.done ? 'checked' : ''} aria-label="${T('Done')}"><input type="text" data-k="title" value="${esc(x.title)}" placeholder="${T('Step')}"><input type="date" data-k="date" value="${x.date || ''}" aria-label="${T('Date')}">`,
          (list) => {
            // A new step defaults to a month after the previous one (or the goal's first month), never past the end.
            const last = list.length && list[list.length - 1].date;
            let mk = last ? mkAdd(last.slice(0, 7), 1) : read('start');
            if (mk > read('end')) mk = read('end');
            return { id: U.uid(), title: '', date: `${mk}-28`, done: false };
          });
        el.querySelector('[data-add-ms]').addEventListener('click', () => { msEd.add(); syncProgress(); });
        // With steps, progress is automatic, so hide the manual slider.
        const syncProgress = () => {
          const hasSteps = msEd.collect().length > 0;
          el.querySelector('[data-progress-field]').hidden = hasSteps;
          el.querySelector('[data-progress-auto]').hidden = !hasSteps;
        };
        el.querySelector('[data-ms]').addEventListener('click', () => setTimeout(syncProgress));
        syncProgress();

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = f.title.value.trim();
          if (!title) return fieldError(form, 'title', T('Please name your goal.'));
          const start = read('start');
          const end = read('end');
          if (end < start) return fieldError(form, 'endM', T('The end must be after the start.'));
          g.title = title;
          g.start = start;
          g.end = end;
          g.category = f.category.value;
          g.progress = Number(f.progress.value);
          g.target = Number(f.target.value) > 0 ? Number(f.target.value) : null;
          g.notes = f.notes.value.trim();
          g.milestones = msEd.collect().filter((x) => x.title.trim())
            .map((x) => ({ id: x.id, title: x.title.trim(), date: x.date || `${end}-15`, done: !!x.done, doneAt: x.done ? x.doneAt || Date.now() : null }))
            .sort((a, b) => a.date.localeCompare(b.date));
          if (App.views.goals) App.views.goals.showGoal(g); // before saving, so the redraw shows it
          store().upsert('goals', g);
          App.ui.toast(isNew ? T('Goal added: {range}', { range: S.goalRange(g) }) : T('Goal saved'));
          m.close();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteGoal(g.id); });
      },
    });
  }

  /* ---------------- One quick step for a goal ---------------- */
  function step(goalId) {
    const g = store().find('goals', goalId);
    if (!g) return;
    const last = g.milestones.length ? g.milestones[g.milestones.length - 1].date.slice(0, 7) : null;
    let mk = last ? mkAdd(last, 1) : (U.todayKey().slice(0, 7) > g.start ? U.todayKey().slice(0, 7) : g.start);
    if (mk > g.end) mk = g.end;
    const m = App.ui.modal({
      title: T('Add step'),
      size: 'sm',
      body: `
        <form id="stepForm" class="form" novalidate>
          <p class="muted sm">${esc(g.title)} · ${esc(S.goalRange(g))}</p>
          <label class="field"><span>${T('Step')}</span><input type="text" name="title" maxlength="200" placeholder="${T('e.g. Save the first 100,000')}" autocomplete="off" autofocus></label>
          <label class="field"><span>${T('Date')}</span><input type="date" name="date" value="${mk}-28"></label>
        </form>`,
      footer: `<span class="spacer"></span><button type="button" class="btn ghost" data-close>${T('Cancel')}</button>
        <button type="submit" class="btn primary" form="stepForm">${T('Add')}</button>`,
      onMount(el) {
        const form = el.querySelector('form');
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = form.elements.title.value.trim();
          if (!title) return fieldError(form, 'title', T('Please name the step.'));
          g.milestones.push({ id: U.uid(), title, date: form.elements.date.value || `${g.end}-15`, done: false, doneAt: null });
          g.milestones.sort((a, b) => a.date.localeCompare(b.date));
          store().save();
          App.ui.toast(T('Step added'));
          m.close();
        });
      },
    });
  }

  /* ---------------- Money saved for a goal ---------------- */
  function money(goalId) {
    const m = App.ui.modal({
      title: T('Money saved'),
      size: 'sm',
      body: '<div data-money></div>',
      onMount(el) {
        const box = el.querySelector('[data-money]');
        const render = () => {
          const g = store().find('goals', goalId);
          if (!g) return m.close();
          const saved = S.goalSaved(g);
          const pct = g.target ? U.clamp((saved / g.target) * 100, 0, 100) : 0;
          box.innerHTML = `
            <p class="money-goal">${esc(g.title)}</p>
            ${g.target ? `
              <div class="money-sum"><strong>${U.money(saved)}</strong><span>${T('of {total}', { total: U.money(g.target) })}</span></div>
              <div class="bar big money-bar"><div style="width:${pct}%"></div></div>
              <p class="muted sm">${saved >= g.target ? T('Target reached 🎉') : T('{amount} left', { amount: U.money(g.target - saved) })}</p>` : `<div class="money-sum"><strong>${U.money(saved)}</strong><span>${T('saved')}</span></div>`}
            <form class="form money-form" id="moneyForm" novalidate>
              <div class="row-2">
                <label class="field"><span>${T('Amount')}</span><input type="number" name="amount" min="0" step="any" inputmode="decimal" placeholder="${T('e.g.')} 20000" autofocus></label>
                <label class="field"><span>${T('Date')}</span><input type="date" name="date" value="${U.todayKey()}"></label>
              </div>
              <button type="submit" class="btn primary">${icon('plus', 16)}${T('Add money')}</button>
            </form>
            ${(g.savings || []).length ? `<ul class="money-list">${g.savings.slice().sort((a, b) => b.date.localeCompare(a.date)).map((x) => `
              <li><span>${U.fmtDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span><strong>${U.money(x.amount)}</strong>
              <button type="button" class="icon-btn sm" data-rm-money="${x.id}" aria-label="${T('Remove')}">${icon('x', 14)}</button></li>`).join('')}</ul>` : ''}`;
          box.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            const f = e.target.elements;
            const amount = Number(f.amount.value);
            if (!(amount > 0)) return fieldError(e.target, 'amount', T('Type how much you saved.'));
            g.savings = g.savings || [];
            g.savings.push({ id: U.uid(), amount, date: f.date.value || U.todayKey() });
            store().save();
            App.ui.toast(T('Added {amount}', { amount: U.money(amount) }));
            render();
            box.querySelector('input[name="amount"]').focus();
          });
          box.querySelectorAll('[data-rm-money]').forEach((b) => b.addEventListener('click', () => {
            g.savings = g.savings.filter((x) => x.id !== b.dataset.rmMoney);
            store().save();
            render();
          }));
        };
        render();
      },
    });
  }

  /* ---------------- Money: spending / income ---------------- */
  const moneyList = () => store().state.money.entries;
  const catPicker = (list, selected) => list.map((c) => `
    <label class="cat-opt"><input type="radio" name="cat" value="${c.id}" ${c.id === selected ? 'checked' : ''}>
      <span><b>${c.icon}</b>${esc(T(c.name))}</span></label>`).join('');
  const amountField = (value) => {
    const cur = store().state.settings.currency;
    return `<label class="field"><span>${T('Amount')}</span>
      <span class="amount-input"><input type="number" name="amount" min="0" step="any" inputmode="decimal" value="${value || ''}" placeholder="0" autofocus>${cur ? `<em>${esc(cur)}</em>` : ''}</span></label>`;
  };

  function entry(existing, preset) {
    const M = App.money;
    const isNew = !existing;
    const e = isNew
      ? { id: U.uid(), type: 'out', amount: '', cat: 'food', date: U.todayKey(), note: '', billId: null, createdAt: Date.now(), ...(preset || {}) }
      : clone(existing);
    const id = 'entryForm';
    const m = App.ui.modal({
      title: isNew ? (e.type === 'in' ? T('Money received') : T('New spending')) : T('Edit payment'),
      body: `
        <form id="${id}" class="form" novalidate>
          <div class="segmented money-type" role="radiogroup">
            <label class="seg out"><input type="radio" name="type" value="out" ${e.type === 'out' ? 'checked' : ''}><span>${icon('upload', 15)}${T('Spent')}</span></label>
            <label class="seg in"><input type="radio" name="type" value="in" ${e.type === 'in' ? 'checked' : ''}><span>${icon('download', 15)}${T('Received')}</span></label>
          </div>
          ${amountField(e.amount)}
          <div class="field"><span>${T('Category')}</span><div class="cat-pick" data-cats></div></div>
          <div class="row-2">
            <label class="field"><span>${T('Date')}</span><input type="date" name="date" value="${e.date}"></label>
            <label class="field"><span>${T('Note')} <em>(${T('optional')})</em></span><input type="text" name="note" maxlength="120" value="${esc(e.note)}" placeholder="${T('What was it for?')}" autocomplete="off"></label>
          </div>
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const f = form.elements;
        const cats = el.querySelector('[data-cats]');
        const drawCats = () => {
          const type = form.querySelector('input[name="type"]:checked').value;
          const list = type === 'in' ? M.CATS_IN : M.CATS_OUT;
          const cur = (form.querySelector('input[name="cat"]:checked') || {}).value || e.cat;
          cats.innerHTML = catPicker(list, list.some((c) => c.id === cur) ? cur : list[0].id);
          if (!cats.querySelector('input:checked')) cats.querySelector('input').checked = true;
        };
        form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', drawCats));
        drawCats();
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const amount = Number(f.amount.value);
          if (!(amount > 0)) return fieldError(form, 'amount', T('Type the amount.'));
          e.type = form.querySelector('input[name="type"]:checked').value;
          e.amount = amount;
          e.cat = form.querySelector('input[name="cat"]:checked').value;
          e.date = f.date.value || U.todayKey();
          e.note = f.note.value.trim();
          const list = moneyList();
          const i = list.findIndex((x) => x.id === e.id);
          if (i >= 0) list[i] = e;
          else list.push(e);
          store().save();
          App.ui.toast(`${e.type === 'in' ? '+' : '−'}${U.money(e.amount)} · ${T(M.cat(e.cat).name)}`, { icon: e.type === 'in' ? 'download' : 'check' });
          m.close();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteEntry(e.id); });
      },
    });
  }

  /* ---------------- Money: monthly bill ---------------- */
  function bill(existing) {
    const M = App.money;
    const isNew = !existing;
    const b = isNew
      ? { id: U.uid(), name: '', amount: '', cat: 'bills', day: new Date().getDate(), start: M.thisMonth(), active: true, paid: {}, createdAt: Date.now() }
      : clone(existing);
    const id = 'billForm';
    const m = App.ui.modal({
      title: isNew ? T('New monthly bill') : T('Edit bill'),
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>${T('Name')}</span>
            <input type="text" name="name" maxlength="80" value="${esc(b.name)}" placeholder="${T('e.g. Internet, rent, generator')}" autocomplete="off" autofocus></label>
          <div class="row-2">
            ${amountField(b.amount).replace(' autofocus', '')}
            <label class="field"><span>${T('Due every month on day')}</span><input type="number" name="day" min="1" max="31" inputmode="numeric" value="${b.day}"></label>
          </div>
          <div class="field"><span>${T('Category')}</span><div class="cat-pick">${catPicker(M.CATS_OUT, b.cat)}</div></div>
          ${phoneButton()}
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const f = form.elements;
        const collect = () => {
          const name = f.name.value.trim();
          if (!name) return fieldError(form, 'name', T('Please give the bill a name.')), false;
          const amount = Number(f.amount.value);
          if (!(amount > 0)) return fieldError(form, 'amount', T('Type the amount.')), false;
          const day = Math.round(Number(f.day.value));
          if (!(day >= 1 && day <= 31)) return fieldError(form, 'day', T('Pick a day from 1 to 31.')), false;
          b.name = name;
          b.amount = amount;
          b.day = day;
          b.cat = (form.querySelector('input[name="cat"]:checked') || { value: 'bills' }).value;
          return true;
        };
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          if (!collect()) return;
          const list = store().state.money.bills;
          const i = list.findIndex((x) => x.id === b.id);
          if (i >= 0) list[i] = b;
          else list.push(b);
          store().save();
          const saved = clone(b);
          App.ui.toast(isNew ? T('Bill added') : T('Bill saved'), isNew ? { action: { label: T('Add to phone calendar'), fn: () => App.ics.bill(saved) }, duration: 6000 } : {});
          m.close();
        });
        el.querySelector('[data-ics]').addEventListener('click', () => { if (collect()) App.ics.bill(b); });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteBill(b.id); });
      },
    });
  }

  /* ---------------- Money: monthly budget ---------------- */
  function budget() {
    const money = store().state.money;
    const m = App.ui.modal({
      title: T('Monthly budget'),
      size: 'sm',
      body: `
        <form id="budgetForm" class="form" novalidate>
          <p class="muted sm">${T('How much do you want to spend at most each month?')}</p>
          ${amountField(money.budget)}
        </form>`,
      footer: `
        ${money.budget ? `<button type="button" class="btn ghost danger-text" data-remove>${icon('trash', 16)}<span>${T('Remove')}</span></button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-close>${T('Cancel')}</button>
        <button type="submit" class="btn primary" form="budgetForm">${T('Save')}</button>`,
      onMount(el) {
        const form = el.querySelector('form');
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const amount = Number(form.elements.amount.value);
          if (!(amount > 0)) return fieldError(form, 'amount', T('Type the amount.'));
          money.budget = amount;
          store().save();
          App.ui.toast(T('Budget saved'));
          m.close();
        });
        const rm = el.querySelector('[data-remove]');
        if (rm) rm.addEventListener('click', () => { money.budget = null; store().save(); m.close(); });
      },
    });
  }

  App.forms = { task, event, habit, goal, step, money, entry, bill, budget };
})();
