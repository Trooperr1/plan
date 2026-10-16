/* Small date / string helpers shared by every module. Dates are stored as local "YYYY-MM-DD" keys. */
(function () {
  const App = (window.App = window.App || {});
  const pad = (n) => String(n).padStart(2, '0');

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_SHORT = DAYS.map((d) => d.slice(0, 3));

  const U = {
    pad,
    MONTHS,
    MONTHS_SHORT,
    DAYS,
    DAYS_SHORT,

    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    toKey(d) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    fromKey(k) {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    todayKey() {
      return U.toKey(new Date());
    },
    addDays(k, n) {
      const d = U.fromKey(k);
      d.setDate(d.getDate() + n);
      return U.toKey(d);
    },
    diffDays(a, b) {
      return Math.round((U.fromKey(b) - U.fromKey(a)) / 86400000);
    },
    weekday(k) {
      return U.fromKey(k).getDay();
    },
    startOfWeek(k, weekStart) {
      const diff = (U.weekday(k) - weekStart + 7) % 7;
      return U.addDays(k, -diff);
    },
    daysInMonth(y, m) {
      return new Date(y, m + 1, 0).getDate();
    },
    daysInYear(y) {
      return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    },
    dayOfYear(k) {
      const d = U.fromKey(k);
      return U.diffDays(`${d.getFullYear()}-01-01`, k) + 1;
    },

    toMin(t) {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    },
    fromMin(m) {
      m = Math.max(0, Math.min(1439, m));
      return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    },
    at(k, time) {
      const d = U.fromKey(k);
      const [h, m] = (time || '00:00').split(':').map(Number);
      d.setHours(h, m, 0, 0);
      return d.getTime();
    },

    fmtTime(t) {
      if (!t) return '';
      const clock = App.store && App.store.state ? App.store.state.settings.clock : '12';
      if (clock === '24') return t;
      let [h, m] = t.split(':').map(Number);
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${pad(m)} ${ap}`;
    },
    fmtHour(h) {
      const clock = App.store && App.store.state ? App.store.state.settings.clock : '12';
      if (clock === '24') return `${pad(h)}:00`;
      return `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
    },
    fmtDate(k, opts) {
      return U.fromKey(k).toLocaleDateString(undefined, opts || { weekday: 'short', month: 'short', day: 'numeric' });
    },
    relDay(k) {
      const diff = U.diffDays(U.todayKey(), k);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      const sameYear = k.slice(0, 4) === U.todayKey().slice(0, 4);
      return U.fmtDate(k, sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    },
    fmtDuration(ms) {
      const min = Math.round(ms / 60000);
      if (min < 1) return 'now';
      if (min < 60) return `${min} min`;
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
      const d = Math.round(h / 24);
      return `${d} day${d > 1 ? 's' : ''}`;
    },

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    debounce(fn, ms) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    },
    clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    },
    greeting() {
      const h = new Date().getHours();
      if (h < 5) return 'Good night';
      if (h < 12) return 'Good morning';
      if (h < 17) return 'Good afternoon';
      return 'Good evening';
    },
  };

  App.util = U;
})();
