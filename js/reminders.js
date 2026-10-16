/* Reminder engine: checks timed tasks/events and shows in-app + system notifications. */
(function () {
  const App = window.App;
  const U = App.util;
  const S = App.sched;
  const GRACE_MS = 60 * 60 * 1000; // still show reminders missed within the last hour
  let audioCtx = null;

  function instances(fromMs, toMs) {
    const out = [];
    const startKey = U.toKey(new Date(fromMs));
    const endKey = U.toKey(new Date(toMs + 86400000)); // 1-day-before reminders for tomorrow
    for (let k = startKey; k <= endKey; k = U.addDays(k, 1)) {
      S.tasksOn(k).forEach((t) => {
        if (!t.time || t.reminder == null || S.isDone(t, k)) return;
        const at = U.at(k, t.time);
        out.push({ kind: 'task', item: t, key: k, at, fireAt: at - t.reminder * 60000 });
      });
      S.eventsOn(k).forEach((e) => {
        if (e.allDay || !e.start || e.reminder == null) return;
        const at = U.at(k, e.start);
        out.push({ kind: 'event', item: e, key: k, at, fireAt: at - e.reminder * 60000 });
      });
    }
    return out.filter((r) => r.fireAt >= fromMs && r.fireAt <= toMs).sort((a, b) => a.fireAt - b.fireAt);
  }

  function upcoming(hours) {
    const now = Date.now();
    return instances(now, now + hours * 3600000);
  }

  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      [0, 0.18].forEach((d, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = i ? 1046 : 784;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.2, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.3);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0 + d);
        o.stop(t0 + d + 0.32);
      });
    } catch (e) { /* audio not available */ }
  }

  function systemNotify(title, body, tag) {
    const settings = App.store.state.settings;
    if (!settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true };
    const fallback = () => {
      try { new Notification(title, options); } catch (e) { /* some mobile browsers only allow SW notifications */ }
    };
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistration().then((reg) => (reg ? reg.showNotification(title, options) : fallback())).catch(fallback);
    } else {
      fallback();
    }
  }

  function fire(title, body, tag) {
    App.ui.toast(`<strong>${U.esc(title)}</strong><span>${U.esc(body)}</span>`, { icon: 'bell', html: true, duration: 12000, type: 'reminder' });
    if (App.store.state.settings.sound) beep();
    systemNotify(title, body, tag);
  }

  function describe(r) {
    const when = r.at - Date.now();
    const time = U.fmtTime(r.kind === 'task' ? r.item.time : r.item.start);
    const day = r.key === U.todayKey() ? '' : `${U.relDay(r.key)} `;
    if (when <= 0) return `${r.kind === 'task' ? 'Task' : 'Event'} · ${day}${time} (started)`;
    return `${r.kind === 'task' ? 'Task' : 'Event'} · ${day}${time} · in ${U.fmtDuration(when)}`;
  }

  function check() {
    const state = App.store.state;
    const now = Date.now();
    let changed = false;
    instances(now - GRACE_MS, now).forEach((r) => {
      const id = `${r.kind}:${r.item.id}:${r.key}:${r.item.reminder}`;
      if (state.notified[id]) return;
      state.notified[id] = r.key;
      changed = true;
      fire(r.item.title, describe(r), id);
    });
    // Forget reminder history older than a week.
    const cutoff = U.addDays(U.todayKey(), -7);
    Object.keys(state.notified).forEach((k) => {
      if (state.notified[k] < cutoff) {
        delete state.notified[k];
        changed = true;
      }
    });
    if (changed) App.store.save({ silent: true });
  }

  async function requestPermission() {
    if (!('Notification' in window)) {
      App.ui.toast('This browser does not support notifications. In-app reminders will still work.', { type: 'danger', duration: 6000 });
      return false;
    }
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    if (p !== 'granted') {
      App.ui.toast('Notifications are blocked. Allow them in your browser site settings.', { type: 'danger', duration: 6000 });
      return false;
    }
    return true;
  }

  function start() {
    check();
    setInterval(check, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
  }

  App.reminders = { start, check, upcoming, fire, describe, requestPermission, beep };
})();
