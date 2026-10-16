/* "Add to phone calendar": builds .ics files so the phone's own calendar rings, even when this app is closed. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;

  const RRULE = {
    daily: 'FREQ=DAILY',
    weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    weekly: 'FREQ=WEEKLY',
    monthly: 'FREQ=MONTHLY',
    yearly: 'FREQ=YEARLY',
  };

  function text(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  // Lines longer than 75 bytes must be folded (RFC 5545). Kurdish letters and emoji take several
  // bytes each, so count bytes and never cut a letter in half.
  const bytes = (ch) => new TextEncoder().encode(ch).length;
  function fold(line) {
    const out = [];
    let cur = '';
    let size = 0;
    for (const ch of line) {
      const b = bytes(ch);
      if (size + b > 74) {
        out.push(cur);
        cur = ' ';
        size = 1;
      }
      cur += ch;
      size += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  const day = (k) => k.replace(/-/g, '');
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

  /* One calendar entry. Times are "floating" so they stay in the phone's own time zone. */
  function vevent(o) {
    let date = o.date;
    // A weekday repeat must start on a weekday.
    if (o.repeat === 'weekdays') while (U.weekday(date) === 0 || U.weekday(date) === 6) date = U.addDays(date, 1);
    const lines = ['BEGIN:VEVENT', `UID:${o.uid}@daily-planner`, `DTSTAMP:${stamp()}`, `SUMMARY:${text(o.title)}`];
    if (o.allDay || !o.start) {
      lines.push(`DTSTART;VALUE=DATE:${day(date)}`, `DTEND;VALUE=DATE:${day(U.addDays(date, 1))}`);
    } else {
      const end = o.end && U.toMin(o.end) > U.toMin(o.start) ? o.end : U.fromMin(U.toMin(o.start) + 30);
      lines.push(`DTSTART:${day(date)}T${o.start.replace(':', '')}00`, `DTEND:${day(date)}T${end.replace(':', '')}00`);
    }
    if (o.rrule) lines.push(`RRULE:${o.rrule}`);
    else if (RRULE[o.repeat]) lines.push(`RRULE:${RRULE[o.repeat]}`);
    if (o.location) lines.push(`LOCATION:${text(o.location)}`);
    if (o.notes) lines.push(`DESCRIPTION:${text(o.notes)}`);
    // Always ring: at the chosen reminder, at the start time, or 9 AM for all-day items.
    const trigger = o.allDay || !o.start ? 'PT9H' : `-PT${o.reminder != null ? o.reminder : 0}M`;
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(o.title)}`, `TRIGGER:${trigger}`, 'END:VALARM', 'END:VEVENT');
    return lines;
  }

  function calendar(events) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daily Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    events.forEach((e) => lines.push(...vevent(e)));
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  function download(name, body) {
    const slug = (name || 'planner').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'planner';
    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    App.ui.toast(App.t('Calendar file downloaded. Open it and tap “Add” to put it in your phone calendar.'), { icon: 'calendar', duration: 7000 });
  }

  function task(t) {
    download(t.title, calendar([{
      uid: t.id, title: t.title, notes: t.notes, date: t.date || U.todayKey(), start: t.time, allDay: !t.time,
      repeat: t.repeat, reminder: t.reminder,
    }]));
  }

  function event(e) {
    download(e.title, calendar([{
      uid: e.id, title: e.title, notes: e.notes, location: e.location, date: e.date, start: e.start, end: e.end,
      allDay: e.allDay, repeat: e.repeat, reminder: e.reminder,
    }]));
  }

  function goal(g) {
    const steps = g.milestones.filter((m) => !m.done);
    const items = steps.length
      ? steps.map((m) => ({ uid: m.id, title: `${m.title} (${g.title})`, date: m.date, allDay: true }))
      : [{ uid: g.id, title: App.t('Goal deadline: {name}', { name: g.title }), date: S.goalEnd(g), allDay: true }];
    download(g.title, calendar(items));
  }

  function bill(b) {
    const M = App.money;
    // First due date from today on.
    let mk = M.thisMonth();
    if (M.billDue(b, mk) < U.todayKey()) mk = M.addMonths(mk, 1);
    // Days 29–31: "the largest of 28…day that exists" = the same rule the app uses.
    const rrule = b.day > 28
      ? `FREQ=MONTHLY;BYMONTHDAY=${Array.from({ length: b.day - 27 }, (_, i) => 28 + i).join(',')};BYSETPOS=-1`
      : `FREQ=MONTHLY;BYMONTHDAY=${b.day}`;
    download(b.name, calendar([{
      uid: b.id, title: `🧾 ${b.name} · ${U.money(b.amount)}`, date: M.billDue(b, mk), allDay: true, rrule,
    }]));
  }

  App.ics = { task, event, goal, bill, calendar };
})();
