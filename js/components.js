/* Reusable HTML snippets for tasks, events and empty states. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const icon = (n, s) => App.icon(n, s);

  function categoryChip(id) {
    const c = App.store.category(id);
    return `<span class="chip" style="--c:${U.esc(c.color)}">${U.esc(c.name)}</span>`;
  }

  function taskItem(t, key, opts) {
    opts = opts || {};
    const done = S.isDone(t, key);
    const subs = t.subtasks || [];
    const subDone = subs.filter((s) => s.done).length;
    const isOverdue = !done && !S.isRecurring(t) && t.date && t.date < U.todayKey();
    const meta = [];
    if (opts.showDate && t.date) meta.push(`<span class="meta ${isOverdue ? 'danger' : ''}">${icon('calendar', 13)}${U.relDay(t.date)}</span>`);
    if (opts.showDate && !t.date) meta.push(`<span class="meta">${icon('inbox', 13)}Someday</span>`);
    if (t.time) meta.push(`<span class="meta">${icon('clock', 13)}${U.fmtTime(t.time)}</span>`);
    meta.push(categoryChip(t.category));
    if (t.priority === 'high') meta.push(`<span class="meta prio-tag">${icon('zap', 13)}High</span>`);
    if (S.isRecurring(t)) meta.push(`<span class="meta" title="${S.REPEATS[t.repeat]}">${icon('repeat', 13)}${S.REPEAT_SHORT[t.repeat]}</span>`);
    if (t.reminder != null && t.time) meta.push(`<span class="meta" title="Reminder set">${icon('bell', 13)}</span>`);
    if (subs.length) meta.push(`<span class="meta">${icon('check', 13)}${subDone}/${subs.length}</span>`);
    if (t.notes) meta.push(`<span class="meta" title="Has notes">${icon('note', 13)}</span>`);
    const goal = !opts.hideGoal && t.goalId && App.store.find('goals', t.goalId);
    if (goal) meta.push(`<span class="meta goal-tag">${icon('flag', 13)}${U.esc(goal.title)}</span>`);

    const subList = opts.showSubs && subs.length
      ? `<ul class="subtask-list">${subs.map((s) => `
          <li class="${s.done ? 'on' : ''}">
            <button type="button" class="mini-check" data-action="toggle-sub" data-id="${t.id}" data-sub="${s.id}" aria-label="Toggle step" aria-pressed="${s.done}">${icon('check', 10)}</button>
            <span>${U.esc(s.title)}</span>
          </li>`).join('')}</ul>`
      : '';

    return `
      <div class="task-item prio-${t.priority} ${done ? 'is-done' : ''}">
        <button type="button" class="check" data-action="toggle-task" data-id="${t.id}" data-date="${key}"
          aria-label="${done ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${done}">${icon('check', 14)}</button>
        <div class="task-main" data-action="edit-task" data-id="${t.id}" role="button" tabindex="0">
          <div class="task-title">${U.esc(t.title)}</div>
          <div class="task-meta">${meta.join('')}</div>
          ${subList}
        </div>
        <button type="button" class="icon-btn del" data-action="delete-task" data-id="${t.id}" aria-label="Delete task">${icon('trash', 16)}</button>
      </div>`;
  }

  function eventItem(e) {
    const c = App.store.category(e.category);
    const meta = [];
    if (e.location) meta.push(`<span class="meta">${icon('pin', 13)}${U.esc(e.location)}</span>`);
    meta.push(categoryChip(e.category));
    if (S.isRecurring(e)) meta.push(`<span class="meta">${icon('repeat', 13)}${S.REPEAT_SHORT[e.repeat]}</span>`);
    if (e.reminder != null && !e.allDay) meta.push(`<span class="meta" title="Reminder set">${icon('bell', 13)}</span>`);
    return `
      <div class="event-item" style="--c:${U.esc(c.color)}" data-action="edit-event" data-id="${e.id}" role="button" tabindex="0">
        <div class="event-time">${e.allDay ? 'All day' : `${U.fmtTime(e.start)}<small>${U.fmtTime(e.end)}</small>`}</div>
        <div class="event-body">
          <div class="event-title">${U.esc(e.title)}</div>
          <div class="task-meta">${meta.join('')}</div>
        </div>
      </div>`;
  }

  function empty(iconName, title, text, actionHtml) {
    return `
      <div class="empty">
        <div class="empty-icon">${icon(iconName, 22)}</div>
        <strong>${U.esc(title)}</strong>
        ${text ? `<p>${U.esc(text)}</p>` : ''}
        ${actionHtml || ''}
      </div>`;
  }

  function progressRing(pct, size, label) {
    size = size || 84;
    const r = size / 2 - 7;
    const c = 2 * Math.PI * r;
    const off = c * (1 - U.clamp(pct, 0, 100) / 100);
    return `
      <div class="ring" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" />
          <circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" />
        </svg>
        <div class="ring-label"><strong>${Math.round(pct)}%</strong>${label ? `<span>${U.esc(label)}</span>` : ''}</div>
      </div>`;
  }

  function options(list, selected) {
    return list.map(([v, label]) => `<option value="${v == null ? '' : U.esc(v)}" ${String(v) === String(selected) || (v == null && selected == null) ? 'selected' : ''}>${U.esc(label)}</option>`).join('');
  }

  App.c = { taskItem, eventItem, empty, progressRing, categoryChip, options };
})();
