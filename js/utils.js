/* Small date / string helpers shared by every module. Dates are stored as local "YYYY-MM-DD" keys. */
(function () {
  const App = (window.App = window.App || {});
  const pad = (n) => String(n).padStart(2, '0');

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_SHORT = DAYS.map((d) => d.slice(0, 3));
  const DAYS_MIN = DAYS.map((d) => d.slice(0, 2));
  // Kurdish (Sorani) names, as used in the Kurdistan Region.
  const KU_MONTHS = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
  const KU_DAYS = ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];
  const KU_DAYS_SHORT = ['یەک', 'دوو', 'سێ', 'چوار', 'پێنج', 'هەینی', 'شەممە'];
  const ku = () => App.i18n && App.i18n.lang() === 'ckb';

  const U = {
    pad,
    get MONTHS() { return ku() ? KU_MONTHS : MONTHS; },
    get MONTHS_SHORT() { return ku() ? KU_MONTHS : MONTHS_SHORT; },
    get DAYS() { return ku() ? KU_DAYS : DAYS; },
    get DAYS_SHORT() { return ku() ? KU_DAYS_SHORT : DAYS_SHORT; },
    get DAYS_MIN() { return ku() ? KU_DAYS_SHORT : DAYS_MIN; },

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
      const ap = ku() ? (h >= 12 ? 'د.ن' : 'پ.ن') : h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${pad(m)} ${ap}`;
    },
    fmtHour(h) {
      const clock = App.store && App.store.state ? App.store.state.settings.clock : '12';
      if (clock === '24') return `${pad(h)}:00`;
      return `${h % 12 || 12} ${ku() ? (h >= 12 ? 'د.ن' : 'پ.ن') : h >= 12 ? 'PM' : 'AM'}`;
    },
    fmtDate(k, opts) {
      opts = opts || { weekday: 'short', month: 'short', day: 'numeric' };
      if (!ku()) return U.fromKey(k).toLocaleDateString(/^en\b/i.test(navigator.language || '') ? navigator.language : 'en-US', opts);
      // Kurdish: "هەینی، 16ی تشرینی یەکەم 2026"
      const d = U.fromKey(k);
      let out = '';
      if (opts.day) out += `${d.getDate()}ی `;
      if (opts.month) out += KU_MONTHS[d.getMonth()];
      if (opts.year) out += ` ${d.getFullYear()}`;
      out = out.trim();
      if (opts.weekday) out = out ? `${KU_DAYS[d.getDay()]}، ${out}` : KU_DAYS[d.getDay()];
      return out;
    },
    relDay(k) {
      const diff = U.diffDays(U.todayKey(), k);
      const T = App.t || ((x) => x);
      if (diff === 0) return T('Today');
      if (diff === 1) return T('Tomorrow');
      if (diff === -1) return T('Yesterday');
      const sameYear = k.slice(0, 4) === U.todayKey().slice(0, 4);
      return U.fmtDate(k, sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    },
    fmtDuration(ms) {
      const min = Math.round(ms / 60000);
      if (ku()) {
        if (min < 1) return 'ئێستا';
        if (min < 60) return `${min} خولەک`;
        const kh = Math.floor(min / 60);
        if (kh < 24) return min % 60 ? `${kh} کاتژمێر و ${min % 60} خولەک` : `${kh} کاتژمێر`;
        return `${Math.round(kh / 24)} ڕۆژ`;
      }
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
    money(n) {
      const cur = App.store && App.store.state ? App.store.state.settings.currency : '';
      const num = Math.round(Number(n) || 0).toLocaleString('en-US');
      return cur ? `${cur} ${num}` : num;
    },
    agoDays(ms) {
      const d = Math.floor((Date.now() - ms) / 86400000);
      if (ku()) return d <= 0 ? 'ئەمڕۆ' : d === 1 ? 'دوێنێ' : `${d} ڕۆژ لەمەوبەر`;
      return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
    },
    greeting() {
      const h = new Date().getHours();
      const T = App.t || ((x) => x);
      if (h < 5) return T('Good night');
      if (h < 12) return T('Good morning');
      if (h < 17) return T('Good afternoon');
      return T('Good evening');
    },
  };

  App.util = U;
})();
