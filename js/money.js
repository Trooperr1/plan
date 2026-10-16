/* Money: spending, income, monthly bills and a monthly budget. Months are "YYYY-MM" keys. */
(function () {
  const App = window.App;
  const U = App.util;
  const T = (x, v) => App.t(x, v);
  const st = () => App.store.state;

  const CATS_OUT = [
    { id: 'food', icon: '🍔', name: 'Food' },
    { id: 'home', icon: '🏠', name: 'Rent & home' },
    { id: 'bills', icon: '💡', name: 'Bills' },
    { id: 'phone', icon: '📱', name: 'Phone & internet' },
    { id: 'transport', icon: '🚗', name: 'Transport' },
    { id: 'shopping', icon: '🛍️', name: 'Shopping' },
    { id: 'health', icon: '💊', name: 'Health' },
    { id: 'family', icon: '👨‍👩‍👧', name: 'Family' },
    { id: 'education', icon: '📚', name: 'Education' },
    { id: 'fun', icon: '🎉', name: 'Fun' },
    { id: 'gifts', icon: '🎁', name: 'Gifts' },
    { id: 'other', icon: '📦', name: 'Other' },
  ];
  const CATS_IN = [
    { id: 'salary', icon: '💼', name: 'Salary' },
    { id: 'business', icon: '🏪', name: 'Business' },
    { id: 'gift_in', icon: '🎁', name: 'Gift received' },
    { id: 'other_in', icon: '💵', name: 'Other income' },
  ];
  const ALL = [...CATS_OUT, ...CATS_IN];
  const UNKNOWN = { id: 'other', icon: '📦', name: 'Other' };

  const cat = (id) => ALL.find((c) => c.id === id) || UNKNOWN;
  const monthOf = (dateKey) => dateKey.slice(0, 7);
  const thisMonth = () => monthOf(U.todayKey());
  function addMonths(mk, n) {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
  }
  function monthName(mk) {
    const [y, m] = mk.split('-').map(Number);
    return `${U.MONTHS[m - 1]} ${y}`;
  }
  function monthDays(mk) {
    const [y, m] = mk.split('-').map(Number);
    return U.daysInMonth(y, m - 1);
  }

  const entries = () => st().money.entries;
  const entriesIn = (from, to) => entries().filter((e) => e.date >= from && e.date <= to);
  const monthEntries = (mk) => entries().filter((e) => e.date.startsWith(mk));

  function totals(list) {
    let spent = 0;
    let received = 0;
    list.forEach((e) => { if (e.type === 'in') received += e.amount; else spent += e.amount; });
    return { spent, received, left: received - spent };
  }

  /* Spending per category for a month, biggest first. */
  function byCategory(mk) {
    const map = {};
    monthEntries(mk).filter((e) => e.type === 'out').forEach((e) => {
      const m = map[e.cat] || (map[e.cat] = { cat: cat(e.cat), total: 0, count: 0 });
      m.total += e.amount;
      m.count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  /* ---- Monthly bills ---- */
  function billDue(bill, mk) {
    return `${mk}-${U.pad(Math.min(bill.day, monthDays(mk)))}`;
  }

  function billEntry(bill, mk) {
    const id = bill.paid[mk];
    return id ? entries().find((e) => e.id === id) || null : null;
  }

  /* Each active bill for a month with its status: paid, overdue, soon (≤ 3 days) or later. */
  function billsFor(mk) {
    const today = U.todayKey();
    return st().money.bills
      .filter((b) => b.active && b.start <= mk)
      .map((bill) => {
        const due = billDue(bill, mk);
        const entry = billEntry(bill, mk);
        const days = U.diffDays(today, due);
        const status = entry ? 'paid' : days < 0 ? 'overdue' : days <= 3 ? 'soon' : 'later';
        return { bill, due, entry, days, status };
      })
      .sort((a, b) => a.due.localeCompare(b.due));
  }

  /* Unpaid bills that are late or due within `days` days (this month and next). */
  function dueSoon(days) {
    const mk = thisMonth();
    return [...billsFor(mk), ...billsFor(addMonths(mk, 1))].filter((x) => !x.entry && x.days <= days);
  }

  function pay(billId, mk) {
    const bill = st().money.bills.find((b) => b.id === billId);
    if (!bill) return;
    const today = U.todayKey();
    const due = billDue(bill, mk);
    const entry = {
      id: U.uid(), type: 'out', amount: bill.amount, cat: bill.cat, note: bill.name,
      // Paid early or on time counts on the payment day; a past month's bill counts on its due day.
      date: monthOf(today) === mk || due > today ? today : due,
      billId: bill.id, createdAt: Date.now(),
    };
    st().money.entries.push(entry);
    bill.paid[mk] = entry.id;
    App.store.save();
    App.ui.toast(T('Paid {name}: {amount}', { name: bill.name, amount: U.money(bill.amount) }), {
      icon: 'check',
      action: { label: T('Undo'), fn: () => unpay(billId, mk, true) },
    });
  }

  function unpay(billId, mk, quiet) {
    const bill = st().money.bills.find((b) => b.id === billId);
    if (!bill) return;
    const id = bill.paid[mk];
    delete bill.paid[mk];
    st().money.entries = entries().filter((e) => e.id !== id);
    App.store.save();
    if (!quiet) App.ui.toast(T('Marked as not paid'));
  }

  /* Short amounts for chart labels: 1.2M, 350K. */
  function compact(n) {
    const ku = App.i18n.lang() === 'ckb';
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}${ku ? ' ملیۆن' : 'M'}`;
    if (n >= 1e3) return `${Math.round(n / 1e3)}${ku ? ' هەزار' : 'K'}`;
    return String(Math.round(n));
  }

  App.money = {
    CATS_OUT, CATS_IN, cat, monthOf, thisMonth, addMonths, monthName, monthDays,
    entriesIn, monthEntries, totals, byCategory, billsFor, billDue, dueSoon, pay, unpay, compact,
  };
})();
