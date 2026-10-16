/* Create / edit dialogs for tasks, events, habits and yearly goals. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const esc = U.esc;
  const icon = (n, s) => App.icon(n, s);
  const opts = (list, sel) => App.c.options(list, sel);
  const store = () => App.store;

  const catOptions = (sel) => opts(store().state.categories.map((c) => [c.id, c.name]), sel);
  const repeatOptions = (sel) => opts(Object.entries(S.REPEATS), sel || 'none');
  const reminderOptions = (sel) => opts(S.REMINDERS, sel);
  const monthOptions = (sel) => opts(U.MONTHS.map((m, i) => [i, m]), sel);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function footer(formId, isNew, deleteAction) {
    return `
      ${!isNew ? `<button type="button" class="btn ghost danger-text" data-delete>${icon('trash', 16)}<span>Delete</span></button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="submit" class="btn primary" form="${formId}">${isNew ? 'Create' : 'Save'}</button>`;
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
        ? items.map((it, i) => `<div class="list-row" data-i="${i}">${rowHtml(it)}<button type="button" class="icon-btn sm" data-rm="${i}" aria-label="Remove">${icon('x', 14)}</button></div>`).join('')
        : '<p class="hint">Nothing added yet.</p>';
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
      title: isNew ? 'New task' : 'Edit task',
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>Title</span>
            <input name="title" type="text" maxlength="200" value="${esc(t.title)}" placeholder="What do you need to do?" autocomplete="off" autofocus></label>
          <div class="row-2">
            <label class="field"><span>Date</span><input type="date" name="date" value="${t.date || ''}"></label>
            <label class="field"><span>Time</span><input type="time" name="time" value="${t.time || ''}"></label>
          </div>
          <div class="row-2">
            <label class="field"><span>Reminder</span><select name="reminder">${reminderOptions(t.reminder)}</select></label>
            <label class="field"><span>Repeat</span><select name="repeat">${repeatOptions(t.repeat)}</select></label>
          </div>
          <p class="hint" data-reminder-hint hidden>${icon('alert', 13)} Pick a date and time so the reminder knows when to ring.</p>
          <details class="more" ${!isNew && (t.subtasks.length || t.notes || t.priority !== 'medium') ? 'open' : ''}>
            <summary>More options</summary>
            <div class="more-body">
              <div class="field"><span>Priority</span>
                <div class="segmented" role="radiogroup">
                  ${['low', 'medium', 'high'].map((p) => `
                    <label class="seg prio-${p}"><input type="radio" name="priority" value="${p}" ${t.priority === p ? 'checked' : ''}><span>${S.PRIORITIES[p]}</span></label>`).join('')}
                </div>
              </div>
              <label class="field"><span>Category</span><select name="category">${catOptions(t.category)}</select></label>
              <div class="field"><span>Checklist</span>
                <div class="list-editor" data-subs></div>
                <button type="button" class="btn ghost sm add-row" data-add-sub>${icon('plus', 14)}Add step</button>
              </div>
              <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Details…">${esc(t.notes)}</textarea></label>
            </div>
          </details>
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const subs = listEditor(el.querySelector('[data-subs]'), t.subtasks.map((s) => ({ ...s })),
          (s) => `<input type="checkbox" data-k="done" ${s.done ? 'checked' : ''} aria-label="Done"><input type="text" data-k="title" value="${esc(s.title)}" placeholder="Step">`,
          () => ({ id: U.uid(), title: '', done: false }));
        el.querySelector('[data-add-sub]').addEventListener('click', subs.add);

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

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const f = form.elements;
          const title = f.title.value.trim();
          if (!title) return fieldError(form, 'title', 'Please give the task a title.');
          const wasRecurring = S.isRecurring(t);
          t.title = title;
          t.date = f.date.value || null;
          t.time = f.time.value || null;
          t.priority = form.querySelector('input[name="priority"]:checked').value;
          t.category = f.category.value;
          t.repeat = f.repeat.value;
          if (S.isRecurring(t) && !t.date) t.date = U.todayKey();
          t.reminder = f.reminder.value === '' ? null : Number(f.reminder.value);
          t.notes = f.notes.value.trim();
          t.subtasks = subs.collect().filter((s) => s.title.trim()).map((s) => ({ id: s.id, title: s.title.trim(), done: !!s.done }));
          if (wasRecurring && !S.isRecurring(t)) t.done = false;
          store().upsert('tasks', t);
          App.ui.toast(isNew ? 'Task created' : 'Task saved');
          m.close();
        });
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
      title: isNew ? 'New event' : 'Edit event',
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>Title</span>
            <input name="title" type="text" maxlength="200" value="${esc(ev.title)}" placeholder="Meeting, class, appointment…" autocomplete="off" autofocus></label>
          <label class="field"><span>Date</span><input type="date" name="date" value="${ev.date || U.todayKey()}" required></label>
          <div class="row-2" data-times>
            <label class="field"><span>Starts</span><input type="time" name="start" value="${ev.start || '09:00'}"></label>
            <label class="field"><span>Ends</span><input type="time" name="end" value="${ev.end || '10:00'}"></label>
          </div>
          <div class="row-2">
            <label class="field" data-reminder><span>Reminder</span><select name="reminder">${reminderOptions(ev.reminder)}</select></label>
            <label class="field"><span>Repeat</span><select name="repeat">${repeatOptions(ev.repeat)}</select></label>
          </div>
          <details class="more" ${!isNew && (ev.allDay || ev.location || ev.notes) ? 'open' : ''}>
            <summary>More options</summary>
            <div class="more-body">
              <label class="field switch-field"><span>All day</span>
                <span class="switch"><input type="checkbox" name="allDay" ${ev.allDay ? 'checked' : ''}><i></i></span></label>
              <label class="field"><span>Category</span><select name="category">${catOptions(ev.category)}</select></label>
              <label class="field"><span>Location</span><input type="text" name="location" value="${esc(ev.location)}" placeholder="Where?" autocomplete="off"></label>
              <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Details…">${esc(ev.notes)}</textarea></label>
            </div>
          </details>
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const f = form.elements;
        const syncAllDay = () => {
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
        });
        f.end.addEventListener('change', () => { ev.end = f.end.value; });
        syncAllDay();

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = f.title.value.trim();
          if (!title) return fieldError(form, 'title', 'Please give the event a title.');
          if (!f.date.value) return fieldError(form, 'date', 'Please choose a date.');
          ev.title = title;
          ev.date = f.date.value;
          ev.allDay = f.allDay.checked;
          ev.start = f.start.value || '09:00';
          ev.end = f.end.value || U.fromMin(U.toMin(ev.start) + 60);
          if (!ev.allDay && U.toMin(ev.end) <= U.toMin(ev.start)) {
            return fieldError(form, 'end', 'The end time must be after the start time.');
          }
          ev.category = f.category.value;
          ev.repeat = f.repeat.value;
          ev.reminder = f.reminder.value === '' ? null : Number(f.reminder.value);
          ev.location = f.location.value.trim();
          ev.notes = f.notes.value.trim();
          store().upsert('events', ev);
          App.ui.toast(isNew ? 'Event created' : 'Event saved');
          m.close();
        });
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
      title: isNew ? 'New habit' : 'Edit habit',
      size: 'sm',
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>Habit</span>
            <input name="name" type="text" maxlength="80" value="${esc(h.name)}" placeholder="e.g. Exercise 30 min" autocomplete="off" autofocus></label>
          <div class="field"><span>Icon</span>
            <div class="emoji-pick">${EMOJIS.map((e) => `<label><input type="radio" name="icon" value="${e}" ${h.icon === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>
          </div>
          <div class="field"><span>Color</span>
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
          if (!name) return fieldError(form, 'name', 'Please name the habit.');
          h.name = name;
          h.icon = form.querySelector('input[name="icon"]:checked').value;
          h.color = form.querySelector('input[name="color"]:checked').value;
          store().upsert('habits', h);
          App.ui.toast(isNew ? 'Habit added' : 'Habit saved');
          m.close();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteHabit(h.id); });
      },
    });
  }

  /* ---------------- Goal ---------------- */
  function goal(existing, preset) {
    const isNew = !existing;
    const g = isNew ? store().newGoal(preset) : clone(existing);
    const id = 'goalForm';
    const m = App.ui.modal({
      title: isNew ? 'New goal' : 'Edit goal',
      body: `
        <form id="${id}" class="form" novalidate>
          <label class="field"><span>Goal</span>
            <input name="title" type="text" maxlength="120" value="${esc(g.title)}" placeholder="e.g. Build my garage" autocomplete="off" autofocus></label>
          <label class="field"><span>Year</span><input type="number" name="year" min="2000" max="2100" value="${g.year}"></label>
          <div class="row-2">
            <label class="field"><span>From</span><select name="startMonth">${monthOptions(g.startMonth)}</select></label>
            <label class="field"><span>To</span><select name="endMonth">${monthOptions(g.endMonth)}</select></label>
          </div>
          <div class="field"><span>Steps <em>(optional)</em></span>
            <div class="list-editor" data-ms></div>
            <button type="button" class="btn ghost sm add-row" data-add-ms>${icon('plus', 14)}Add step</button>
          </div>
          <details class="more" ${!isNew && (g.notes || g.progress) ? 'open' : ''}>
            <summary>More options</summary>
            <div class="more-body">
              <label class="field"><span>Progress <output data-out>${g.progress}%</output></span>
                <input type="range" name="progress" min="0" max="100" step="5" value="${g.progress}"></label>
              <label class="field"><span>Category</span><select name="category">${catOptions(g.category)}</select></label>
              <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Why it matters, your plan…">${esc(g.notes)}</textarea></label>
            </div>
          </details>
        </form>`,
      footer: footer(id, isNew),
      onMount(el) {
        const form = el.querySelector('form');
        const f = form.elements;
        f.progress.addEventListener('input', () => { el.querySelector('[data-out]').textContent = `${f.progress.value}%`; });
        const year = () => Number(f.year.value) || g.year;
        const msEd = listEditor(el.querySelector('[data-ms]'), g.milestones.map((x) => ({ ...x })),
          (x) => `<input type="checkbox" data-k="done" ${x.done ? 'checked' : ''} aria-label="Done"><input type="text" data-k="title" value="${esc(x.title)}" placeholder="Step"><input type="date" data-k="date" value="${x.date || ''}" aria-label="Step date">`,
          (list) => {
            // Each new step defaults to a month after the previous one, inside the goal's year.
            const y = year();
            let m = Number(f.startMonth.value);
            const last = list.length && list[list.length - 1].date;
            if (last && Number(last.slice(0, 4)) === y) m = Math.min(11, Number(last.slice(5, 7)));
            return { id: U.uid(), title: '', date: `${y}-${U.pad(m + 1)}-${U.pad(Math.min(28, U.daysInMonth(y, m)))}`, done: false };
          });
        el.querySelector('[data-add-ms]').addEventListener('click', msEd.add);

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const title = f.title.value.trim();
          if (!title) return fieldError(form, 'title', 'Please name your goal.');
          const yr = Number(f.year.value);
          if (!yr || yr < 2000 || yr > 2100) return fieldError(form, 'year', 'Please enter a valid year.');
          let sm = Number(f.startMonth.value);
          let em = Number(f.endMonth.value);
          if (em < sm) [sm, em] = [em, sm];
          g.title = title;
          g.year = yr;
          g.category = f.category.value;
          g.startMonth = sm;
          g.endMonth = em;
          g.progress = Number(f.progress.value);
          g.notes = f.notes.value.trim();
          g.milestones = msEd.collect().filter((x) => x.title.trim())
            .map((x) => ({ id: x.id, title: x.title.trim(), date: x.date || `${yr}-${U.pad(em + 1)}-15`, done: !!x.done }))
            .sort((a, b) => a.date.localeCompare(b.date));
          store().upsert('goals', g);
          if (App.views.goals) App.views.goals.showYear(g.year);
          App.ui.toast(isNew ? `Goal added to ${g.year}` : 'Goal saved');
          m.close();
        });
        const del = el.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => { m.close(); App.actions.deleteGoal(g.id); });
      },
    });
  }

  App.forms = { task, event, habit, goal };
})();
