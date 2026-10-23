/* Calendar — month and week views with a day detail panel. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const C = App.c;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);
  const HOUR_PX = 48;

  const view = { title: 'Calendar', mode: 'month', cursor: null, selected: null };

  const ws = () => App.store.state.settings.weekStart;
  const weekdayHeaders = () => Array.from({ length: 7 }, (_, i) => U.DAYS_SHORT[(i + ws()) % 7]);

  view.goto = function (key, mode) {
    view.cursor = key;
    view.selected = key;
    if (mode) view.mode = mode;
  };

  function title(cursor) {
    const d = U.fromKey(cursor);
    if (view.mode === 'month') return `${U.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const s = U.startOfWeek(cursor, ws());
    const e = U.addDays(s, 6);
    const sd = U.fromKey(s);
    const ed = U.fromKey(e);
    if (App.i18n.lang() === 'ckb') {
      if (sd.getMonth() === ed.getMonth()) return `${sd.getDate()} – ${ed.getDate()}ی ${U.MONTHS[ed.getMonth()]} ${ed.getFullYear()}`;
      return `${sd.getDate()}ی ${U.MONTHS[sd.getMonth()]} – ${ed.getDate()}ی ${U.MONTHS[ed.getMonth()]} ${ed.getFullYear()}`;
    }
    if (sd.getMonth() === ed.getMonth()) return `${U.MONTHS_SHORT[sd.getMonth()]} ${sd.getDate()} – ${ed.getDate()}, ${ed.getFullYear()}`;
    return `${U.MONTHS_SHORT[sd.getMonth()]} ${sd.getDate()} – ${U.MONTHS_SHORT[ed.getMonth()]} ${ed.getDate()}, ${ed.getFullYear()}`;
  }

  function month(cursor, selected) {
    const d = U.fromKey(cursor);
    const y = d.getFullYear();
    const m = d.getMonth();
    const today = U.todayKey();
    const start = U.startOfWeek(U.toKey(new Date(y, m, 1)), ws());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const k = U.addDays(start, i);
      const kd = U.fromKey(k);
      const events = S.eventsOn(k);
      const tasks = S.tasksOn(k);
      const items = [
        ...events.map((e) => `<span class="cal-chip ev" style="--c:${U.esc(App.store.category(e.category).color)}">${e.allDay ? '' : `<b>${U.fmtTime(e.start).replace(':00', '')}</b> `}${U.esc(e.title)}</span>`),
        ...tasks.map((t) => `<span class="cal-chip tk ${S.isDone(t, k) ? 'done' : ''}" style="--c:${U.esc(App.store.category(t.category).color)}">${U.esc(t.title)}</span>`),
      ];
      const more = items.length > 3 ? `<span class="cal-more">${T('+{n} more', { n: items.length - 3 })}</span>` : '';
      const dots = [...events.slice(0, 3).map((e) => App.store.category(e.category).color), ...tasks.slice(0, 2).map(() => 'var(--muted)')]
        .map((c) => `<i style="background:${U.esc(c)}"></i>`).join('');
      cells.push(`
        <div class="cal-cell ${kd.getMonth() !== m ? 'out' : ''} ${k === today ? 'today' : ''} ${k === selected ? 'selected' : ''}"
          data-action="select-day" data-date="${k}" role="gridcell" tabindex="0" aria-label="${U.fmtDate(k, { weekday: 'long', month: 'long', day: 'numeric' })}, ${T('{n} items', { n: items.length })}">
          <span class="cal-num">${kd.getDate()}</span>
          <div class="cal-items">${items.slice(0, 3).join('')}${more}</div>
          <div class="cal-dots">${dots}</div>
        </div>`);
    }
    return `
      <div class="cal-month" role="grid">
        <div class="cal-weekdays">${weekdayHeaders().map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>`;
  }

  /* Put overlapping timed items side by side. */
  function layout(items) {
    items.sort((a, b) => a.s - b.s || b.e - a.e);
    const clusters = [];
    let cur = [];
    let curEnd = -1;
    items.forEach((it) => {
      if (cur.length && it.s >= curEnd) {
        clusters.push(cur);
        cur = [];
      }
      cur.push(it);
      curEnd = Math.max(curEnd, it.e);
    });
    if (cur.length) clusters.push(cur);
    clusters.forEach((cl) => {
      const cols = [];
      cl.forEach((it) => {
        let i = cols.findIndex((end) => end <= it.s);
        if (i < 0) {
          i = cols.length;
          cols.push(it.e);
        } else cols[i] = it.e;
        it.col = i;
      });
      cl.forEach((it) => { it.ncols = cols.length; });
    });
    return items;
  }

  function week(cursor, selected) {
    const start = U.startOfWeek(cursor, ws());
    const today = U.todayKey();
    const days = Array.from({ length: 7 }, (_, i) => U.addDays(start, i));
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const head = days.map((k) => {
      const d = U.fromKey(k);
      return `<button type="button" class="wk-day ${k === today ? 'today' : ''} ${k === selected ? 'selected' : ''}" data-action="select-day" data-date="${k}">
        <span>${U.DAYS_SHORT[d.getDay()]}</span><strong>${d.getDate()}</strong></button>`;
    }).join('');

    const allDay = days.map((k) => {
      const items = [
        ...S.eventsOn(k).filter((e) => e.allDay).map((e) => `<span class="cal-chip ev" style="--c:${U.esc(App.store.category(e.category).color)}" data-action="edit-event" data-id="${e.id}">${U.esc(e.title)}</span>`),
        ...S.tasksOn(k).filter((t) => !t.time).map((t) => `<span class="cal-chip tk ${S.isDone(t, k) ? 'done' : ''}" style="--c:${U.esc(App.store.category(t.category).color)}" data-action="edit-task" data-id="${t.id}">${U.esc(t.title)}</span>`),
      ];
      return `<div class="wk-allday-cell">${items.join('')}</div>`;
    }).join('');

    const cols = days.map((k) => {
      const items = [
        ...S.eventsOn(k).filter((e) => !e.allDay).map((e) => ({ kind: 'event', item: e, s: U.toMin(e.start), e: Math.max(U.toMin(e.end), U.toMin(e.start) + 15) })),
        ...S.tasksOn(k).filter((t) => t.time).map((t) => ({ kind: 'task', item: t, s: U.toMin(t.time), e: U.toMin(S.taskEnd(t)) })),
      ];
      const blocks = layout(items).map((it) => {
        const c = App.store.category(it.item.category).color;
        const top = (it.s / 60) * HOUR_PX;
        const h = Math.max(20, ((it.e - it.s) / 60) * HOUR_PX - 2);
        const w = 100 / it.ncols;
        const done = it.kind === 'task' && S.isDone(it.item, k);
        return `<div class="wk-block ${it.kind} ${done ? 'done' : ''}" style="--c:${U.esc(c)};top:${top}px;height:${h}px;left:calc(${w * it.col}% + 2px);width:calc(${w}% - 4px)"
          data-action="${it.kind === 'task' ? 'edit-task' : 'edit-event'}" data-id="${it.item.id}" title="${U.esc(it.item.title)}">
          <strong>${it.kind === 'task' ? '☐ ' : ''}${U.esc(it.item.title)}</strong>
          <span>${U.fmtTime(U.fromMin(it.s))}${it.kind === 'event' || it.item.endTime ? ` – ${U.fmtTime(U.fromMin(it.e))}` : ''}</span></div>`;
      }).join('');
      const nowLine = k === today ? `<div class="wk-now" style="top:${(nowMin / 60) * HOUR_PX}px"></div>` : '';
      return `<div class="wk-col ${k === today ? 'today' : ''}" data-action="week-slot" data-date="${k}">${blocks}${nowLine}</div>`;
    }).join('');

    const hours = Array.from({ length: 24 }, (_, h) => `<span style="top:${h * HOUR_PX}px">${h ? U.fmtHour(h) : ''}</span>`).join('');

    return `
      <div class="cal-week">
        <div class="wk-head"><span></span>${head}</div>
        <div class="wk-allday"><span class="wk-label">${T('All day')}</span>${allDay}</div>
        <div class="wk-scroll" id="weekScroll" data-keep-scroll>
          <div class="wk-grid" style="height:${24 * HOUR_PX}px;--hour:${HOUR_PX}px">
            <div class="wk-hours">${hours}</div>
            ${cols}
          </div>
        </div>
      </div>`;
  }

  function dayPanel(key) {
    const events = S.eventsOn(key);
    const tasks = S.tasksOn(key);
    const st = S.dayStats(key);
    return `
      <aside class="card day-panel">
        <div class="card-head">
          <div>
            <h3>${U.esc(U.relDay(key))}</h3>
            <p class="muted sm">${U.fmtDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <a class="btn ghost sm" href="#/today" data-action="open-day" data-date="${key}">${T('Open day')}</a>
        </div>
        <div class="panel-actions">
          <button type="button" class="btn ghost sm" data-action="new-event" data-date="${key}">${icon('plus', 14)}${T('Event')}</button>
          <button type="button" class="btn ghost sm" data-action="new-task" data-date="${key}">${icon('plus', 14)}${T('Task')}</button>
        </div>
        <div class="group-label">${icon('calendar', 14)} ${T('Events')} <span>${events.length}</span></div>
        ${events.length ? `<div class="event-list">${events.map((e) => C.eventItem(e)).join('')}</div>` : `<p class="muted sm pad">${T('No events.')}</p>`}
        <div class="group-label">${icon('list', 14)} ${T('Tasks')} <span>${st.done}/${st.total}</span></div>
        ${tasks.length ? `<div class="task-list">${tasks.map((t) => C.taskItem(t, key)).join('')}</div>` : `<p class="muted sm pad">${T('No tasks.')}</p>`}
      </aside>`;
  }

  view.render = function () {
    const today = U.todayKey();
    view.cursor = view.cursor || today;
    view.selected = view.selected || today;
    return `
      <div class="calendar">
        <div class="toolbar">
          <div class="toolbar-left">
            <button type="button" class="icon-btn" data-action="cal-prev" aria-label="${T('Previous')}">${icon('left')}</button>
            <button type="button" class="icon-btn" data-action="cal-next" aria-label="${T('Next')}">${icon('right')}</button>
            <h2>${title(view.cursor)}</h2>
            <button type="button" class="btn ghost sm" data-action="cal-today">${T('Today')}</button>
          </div>
          <div class="segmented compact" role="tablist">
            <button type="button" class="seg-btn ${view.mode === 'month' ? 'on' : ''}" data-action="cal-mode" data-mode="month" role="tab" aria-selected="${view.mode === 'month'}">${icon('grid', 15)}${T('Month')}</button>
            <button type="button" class="seg-btn ${view.mode === 'week' ? 'on' : ''}" data-action="cal-mode" data-mode="week" role="tab" aria-selected="${view.mode === 'week'}">${icon('columns', 15)}${T('Week')}</button>
          </div>
        </div>
        <div class="cal-layout">
          <section class="card cal-main">${view.mode === 'month' ? month(view.cursor, view.selected) : week(view.cursor, view.selected)}</section>
          ${dayPanel(view.selected)}
        </div>
      </div>`;
  };

  view.mounted = function (el, info) {
    const sc = el.querySelector('#weekScroll');
    if (sc && info.fresh) {
      const nowH = new Date().getHours();
      sc.scrollTop = Math.max(0, Math.min(7, nowH - 2)) * HOUR_PX;
    }
  };

  view.onClick = function (e, a) {
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'cal-prev' || act === 'cal-next') {
      const dir = act === 'cal-prev' ? -1 : 1;
      if (view.mode === 'month') {
        const d = U.fromKey(view.cursor);
        view.cursor = U.toKey(new Date(d.getFullYear(), d.getMonth() + dir, 1));
      } else {
        view.cursor = U.addDays(view.cursor, 7 * dir);
        view.selected = U.addDays(view.selected, 7 * dir);
      }
      App.render({ fresh: view.mode === 'week' ? false : true });
    } else if (act === 'cal-today') {
      view.cursor = view.selected = U.todayKey();
      App.render({ fresh: true });
    } else if (act === 'cal-mode') {
      view.mode = a.dataset.mode;
      view.cursor = view.selected;
      App.render({ fresh: true });
    } else if (act === 'select-day') {
      view.selected = a.dataset.date;
      if (view.mode === 'month') {
        const sel = U.fromKey(view.selected);
        const cur = U.fromKey(view.cursor);
        if (sel.getMonth() !== cur.getMonth()) view.cursor = view.selected;
      }
      App.render();
      if (window.matchMedia('(max-width: 1180px)').matches) {
        const panel = document.querySelector('.day-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (act === 'week-slot' && e.target === a) {
      const rect = a.getBoundingClientRect();
      const min = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
      const start = U.fromMin(U.clamp(min, 0, 23 * 60));
      App.forms.event(null, { date: a.dataset.date, start, end: U.fromMin(U.toMin(start) + 60) });
    }
  };

  view.onKeydown = function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.cal-cell')) {
      e.preventDefault();
      e.target.click();
    }
  };

  App.views.calendar = view;
})();
