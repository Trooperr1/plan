/* Money — where your money goes each month: spending, income, monthly bills and budget. */
(function () {
  const App = window.App;
  const U = App.util;
  const C = App.c;
  const M = App.money;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);

  const view = { title: 'Money', month: null, filter: 'all' };

  const sign = (e) => (e.type === 'in' ? '+' : '−');

  function summary(mk) {
    const cur = M.totals(M.monthEntries(mk));
    const prev = M.totals(M.monthEntries(M.addMonths(mk, -1)));
    let change = '';
    if (prev.spent > 0 && cur.spent > 0) {
      const pct = Math.round(((cur.spent - prev.spent) / prev.spent) * 100);
      change = pct === 0
        ? `<small class="trend">${T('Same as last month')}</small>`
        : `<small class="trend ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${T('{pct}% vs last month', { pct: Math.abs(pct) })}</small>`;
    }
    return `
      <div class="money-tiles">
        <div class="card m-tile spent">
          <span class="m-label">${icon('upload', 15)} ${T('Spent')}</span>
          <strong>${U.money(cur.spent)}</strong>${change}
        </div>
        <div class="card m-tile received">
          <span class="m-label">${icon('download', 15)} ${T('Received')}</span>
          <strong>${U.money(cur.received)}</strong>
        </div>
        <div class="card m-tile left ${cur.left < 0 ? 'neg' : ''}">
          <span class="m-label">${icon('wallet', 15)} ${T('Left')}</span>
          <strong>${cur.left < 0 ? '−' : ''}${U.money(Math.abs(cur.left))}</strong>
          ${cur.left < 0 ? `<small class="trend up">${T('You spent more than you received')}</small>` : ''}
        </div>
      </div>`;
  }

  function budgetCard(mk) {
    const budget = App.store.state.money.budget;
    if (!budget) {
      return `
        <section class="card budget-card empty-budget">
          <div><strong>${T('Set a monthly budget')}</strong><p class="muted sm">${T('See how much you can still spend this month.')}</p></div>
          <button type="button" class="btn ghost sm" data-action="money-budget">${icon('target', 14)}${T('Set budget')}</button>
        </section>`;
    }
    const spent = M.totals(M.monthEntries(mk)).spent;
    const pct = (spent / budget) * 100;
    const state = pct > 100 ? 'over' : pct >= 80 ? 'near' : 'ok';
    let line;
    if (state === 'over') line = T('{amount} over your budget', { amount: U.money(spent - budget) });
    else if (mk === M.thisMonth()) {
      const daysLeft = M.monthDays(mk) - new Date().getDate() + 1;
      line = T('{amount} left · about {perDay} a day for {n} days', { amount: U.money(budget - spent), perDay: U.money((budget - spent) / daysLeft), n: daysLeft });
    } else line = T('{amount} left', { amount: U.money(budget - spent) });
    return `
      <section class="card budget-card ${state}">
        <div class="budget-head">
          <strong>${T('Budget')}: ${U.money(budget)}</strong>
          <span class="budget-pct">${Math.round(pct)}%</span>
          <button type="button" class="icon-btn sm" data-action="money-budget" aria-label="${T('Edit budget')}">${icon('edit', 14)}</button>
        </div>
        <div class="budget-bar" role="img" aria-label="${Math.round(pct)}%"><span style="width:${Math.min(100, pct)}%"></span></div>
        <p class="sm budget-line">${state === 'over' ? icon('alert', 14) : state === 'near' ? icon('alert', 14) : icon('check', 14)} ${line}</p>
      </section>`;
  }

  function categories(mk) {
    const rows = M.byCategory(mk);
    if (!rows.length) return C.empty('wallet', T('No spending this month yet'), T('Add what you spend to see where your money goes.'));
    const total = rows.reduce((s, r) => s + r.total, 0);
    const max = rows[0].total;
    return `<ul class="cat-bars">${rows.map((r) => {
      const pct = Math.round((r.total / total) * 100);
      return `
        <li title="${U.esc(T(r.cat.name))}: ${U.money(r.total)} · ${pct}% · ${T('{n} payments', { n: r.count })}">
          <span class="cb-icon">${r.cat.icon}</span>
          <div class="cb-main">
            <div class="cb-top"><span>${U.esc(T(r.cat.name))}</span><strong>${U.money(r.total)}</strong></div>
            <div class="cb-track"><span style="width:${Math.max(2, (r.total / max) * 100)}%"></span></div>
          </div>
          <span class="cb-pct">${pct}%</span>
        </li>`;
    }).join('')}</ul>`;
  }

  function bills(mk) {
    const list = M.billsFor(mk);
    if (!list.length) {
      return C.empty('receipt', T('No monthly bills yet'), T('Add rent, internet, phone or anything you pay every month.'),
        `<button type="button" class="btn ghost sm" data-action="money-new-bill">${icon('plus', 14)}${T('Add bill')}</button>`);
    }
    const paid = list.filter((x) => x.entry);
    const sum = list.reduce((s, x) => s + x.bill.amount, 0);
    return `
      <p class="muted sm bills-sum">${T('{paid} of {total} paid', { paid: paid.length, total: list.length })} · ${T('{amount} a month', { amount: U.money(sum) })}</p>
      <ul class="bill-list">${list.map((x) => {
        const c = M.cat(x.bill.cat);
        const label = x.status === 'paid' ? T('Paid')
          : x.status === 'overdue' ? T('Late by {n} days', { n: -x.days })
            : x.days === 0 ? T('Due today') : x.days === 1 ? T('Due tomorrow')
              : x.status === 'soon' ? T('Due in {n} days', { n: x.days }) : T('Due {date}', { date: U.fmtDate(x.due, { day: 'numeric', month: 'short' }) });
        return `
          <li class="bill ${x.status}">
            <span class="cb-icon">${c.icon}</span>
            <div class="bill-main" data-action="money-edit-bill" data-id="${x.bill.id}" role="button" tabindex="0">
              <strong>${U.esc(x.bill.name)}</strong>
              <span class="bill-status">${x.status === 'overdue' ? icon('alert', 12) : x.status === 'paid' ? icon('check', 12) : icon('clock', 12)}${label}</span>
            </div>
            <span class="bill-amount">${U.money(x.bill.amount)}</span>
            ${x.entry
              ? `<button type="button" class="btn ghost sm paid-btn" data-action="money-unpay" data-id="${x.bill.id}" data-month="${mk}" title="${T('Mark as not paid')}">${icon('check', 14)}${T('Paid')}</button>`
              : `<button type="button" class="btn primary sm" data-action="money-pay" data-id="${x.bill.id}" data-month="${mk}">${T('Pay')}</button>`}
          </li>`;
      }).join('')}</ul>`;
  }

  /* Spending for the 6 months up to the chosen one, as simple bars on one scale. */
  function trend(mk) {
    const months = Array.from({ length: 6 }, (_, i) => M.addMonths(mk, i - 5));
    const data = months.map((m) => ({ m, spent: M.totals(M.monthEntries(m)).spent }));
    const max = Math.max(...data.map((d) => d.spent));
    if (!max) return `<p class="muted sm">${T('Your spending over the last 6 months will show here.')}</p>`;
    const withData = data.filter((d) => d.spent > 0);
    const avg = withData.reduce((s, d) => s + d.spent, 0) / withData.length;
    return `
      <div class="trend-chart" role="img" aria-label="${T('Spending in the last 6 months')}">
        ${data.map((d) => {
          const [y, mo] = d.m.split('-').map(Number);
          return `
            <div class="tc-col ${d.m === mk ? 'cur' : ''}" title="${U.esc(M.monthName(d.m))}: ${U.money(d.spent)}" data-action="money-month" data-month="${d.m}">
              <span class="tc-val">${d.spent ? M.compact(d.spent) : ''}</span>
              <div class="tc-track"><span style="height:${d.spent ? Math.max(3, (d.spent / max) * 100) : 0}%"></span></div>
              <span class="tc-label">${U.MONTHS_SHORT[mo - 1]}${mo === 1 ? ` ${y}` : ''}</span>
            </div>`;
        }).join('')}
      </div>
      <p class="muted sm">${T('Average: {amount} a month', { amount: U.money(avg) })}</p>
      <details class="table-view"><summary>${T('Show as table')}</summary>
        <table><tbody>${data.map((d) => `<tr><td>${U.esc(M.monthName(d.m))}</td><td>${U.money(d.spent)}</td></tr>`).join('')}</tbody></table>
      </details>`;
  }

  function payments(mk) {
    let list = M.monthEntries(mk);
    const used = [...new Set(list.map((e) => e.cat))].map(M.cat);
    if (view.filter !== 'all') list = list.filter((e) => e.cat === view.filter);
    list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    const days = {};
    list.forEach((e) => { (days[e.date] = days[e.date] || []).push(e); });
    const filter = used.length > 1 ? `
      <select id="moneyFilter" aria-label="${T('Category')}">
        <option value="all">${T('All categories')}</option>
        ${used.map((c) => `<option value="${c.id}" ${view.filter === c.id ? 'selected' : ''}>${c.icon} ${U.esc(T(c.name))}</option>`).join('')}
      </select>` : '';
    const body = list.length ? Object.keys(days).map((d) => {
      const dayTotal = days[d].filter((e) => e.type === 'out').reduce((s, e) => s + e.amount, 0);
      return `
        <div class="group-label">${U.relDay(d)}${dayTotal ? `<span>−${U.money(dayTotal)}</span>` : ''}</div>
        <ul class="pay-list">${days[d].map((e) => {
          const c = M.cat(e.cat);
          return `
            <li class="pay ${e.type}" data-action="money-edit" data-id="${e.id}" role="button" tabindex="0">
              <span class="cb-icon">${c.icon}</span>
              <div class="pay-main"><strong>${U.esc(e.note || T(c.name))}</strong><span>${U.esc(T(c.name))}${e.billId ? ` · ${T('Monthly bill')}` : ''}</span></div>
              <span class="pay-amount">${sign(e)}${U.money(e.amount)}</span>
            </li>`;
        }).join('')}</ul>`;
    }).join('') : C.empty('receipt', T('No payments this month'), view.filter === 'all' ? T('Tap “Spent” to add what you paid for.') : '');
    return { filter, body };
  }

  view.render = function () {
    const mk = view.month || M.thisMonth();
    const isNow = mk === M.thisMonth();
    const p = payments(mk);
    return `
      <div class="money-page">
        <div class="toolbar">
          <div class="toolbar-left">
            <button type="button" class="icon-btn" data-action="money-prev" aria-label="${T('Previous')}">${icon('left')}</button>
            <button type="button" class="icon-btn" data-action="money-next" aria-label="${T('Next')}">${icon('right')}</button>
            <h2>${U.esc(M.monthName(mk))}</h2>
            ${isNow ? '' : `<button type="button" class="btn ghost sm" data-action="money-now">${T('This month')}</button>`}
          </div>
          <div class="hero-buttons">
            <button type="button" class="btn primary" data-action="money-add" data-type="out">${icon('upload', 16)}${T('Spent')}</button>
            <button type="button" class="btn ghost" data-action="money-add" data-type="in">${icon('download', 16)}${T('Received')}</button>
          </div>
        </div>

        ${summary(mk)}
        ${budgetCard(mk)}

        <div class="today-cols">
          <section class="card">
            <div class="card-head"><h3>${icon('grid')} ${T('Where your money goes')}</h3></div>
            ${categories(mk)}
          </section>
          <section class="card">
            <div class="card-head">
              <h3>${icon('receipt')} ${T('Monthly bills')}</h3>
              <button type="button" class="btn ghost sm" data-action="money-new-bill">${icon('plus', 14)}${T('Add bill')}</button>
            </div>
            ${bills(mk)}
          </section>
        </div>

        <div class="today-cols">
          <section class="card">
            <div class="card-head"><h3>${icon('list')} ${T('Payments')}</h3>${p.filter}</div>
            ${p.body}
          </section>
          <section class="card">
            <div class="card-head"><h3>${icon('calendar')} ${T('Last 6 months')}</h3></div>
            ${trend(mk)}
          </section>
        </div>
      </div>`;
  };

  view.onClick = async function (e, a) {
    if (!a) return;
    const mk = view.month || M.thisMonth();
    const money = App.store.state.money;
    switch (a.dataset.action) {
      case 'money-prev': view.month = M.addMonths(mk, -1); view.filter = 'all'; App.render({ fresh: true }); break;
      case 'money-next': view.month = M.addMonths(mk, 1); view.filter = 'all'; App.render({ fresh: true }); break;
      case 'money-now': view.month = null; view.filter = 'all'; App.render({ fresh: true }); break;
      case 'money-month': view.month = a.dataset.month === M.thisMonth() ? null : a.dataset.month; App.render(); break;
      case 'money-add': {
        // Adding in another month starts on that month's 1st (or today in this month).
        const date = mk === M.thisMonth() ? U.todayKey() : `${mk}-01`;
        App.forms.entry(null, { type: a.dataset.type, cat: a.dataset.type === 'in' ? 'salary' : 'food', date });
        break;
      }
      case 'money-edit': { const x = money.entries.find((y) => y.id === a.dataset.id); if (x) App.forms.entry(x); break; }
      case 'money-new-bill': App.forms.bill(); break;
      case 'money-edit-bill': { const b = money.bills.find((y) => y.id === a.dataset.id); if (b) App.forms.bill(b); break; }
      case 'money-pay': M.pay(a.dataset.id, a.dataset.month); break;
      case 'money-unpay':
        if (await App.ui.confirm(T('Mark this bill as not paid? Its payment will be removed.'), { okText: T('Not paid'), title: T('Mark as not paid') })) {
          M.unpay(a.dataset.id, a.dataset.month);
        }
        break;
      case 'money-budget': App.forms.budget(); break;
      default:
    }
  };

  view.onChange = function (e) {
    if (e.target.id === 'moneyFilter') {
      view.filter = e.target.value;
      App.render();
    }
  };

  App.views.money = view;
})();
