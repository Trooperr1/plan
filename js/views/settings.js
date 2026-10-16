/* Settings — language, name, look, reminders and backup. */
(function () {
  const App = window.App;
  const U = App.util;
  const icon = (n, s) => App.icon(n, s);
  const T = (x, v) => App.t(x, v);

  const view = { title: 'Settings' };

  function permissionLabel() {
    if (!('Notification' in window)) return T('Not supported in this browser');
    return T({ granted: 'Allowed', denied: 'Blocked in browser settings', default: 'Not asked yet' }[Notification.permission]);
  }

  view.render = function () {
    const s = App.store.state.settings;
    const sel = (v, cur) => (String(v) === String(cur) ? 'selected' : '');
    const lang = App.i18n.lang();

    return `
      <div class="settings-page">
        <section class="card">
          <div class="card-head"><h3>🌐 ${T('Language')} · Language</h3></div>
          <div class="lang-pick" role="radiogroup" aria-label="Language">
            ${Object.entries(App.i18n.LANGS).map(([id, l]) => `
              <label class="lang-opt ${lang === id ? 'on' : ''}" ${id === 'ckb' ? 'lang="ckb" dir="rtl"' : 'lang="en" dir="ltr"'}>
                <input type="radio" name="lang" value="${id}" data-setting="lang" ${lang === id ? 'checked' : ''}>
                <span>${l.name}</span>
              </label>`).join('')}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('sun')} ${T('General')}</h3></div>
          <div class="settings-grid">
            <label class="field"><span>${T('Your name')}</span><input type="text" id="setName" data-setting="name" value="${U.esc(s.name)}" placeholder="${T('For your greeting')}" maxlength="40" autocomplete="given-name"></label>
            <label class="field"><span>${T('Theme')}</span>
              <select id="setTheme" data-setting="theme">
                <option value="system" ${sel('system', s.theme)}>${T('Automatic')}</option>
                <option value="light" ${sel('light', s.theme)}>${T('Light')}</option>
                <option value="dark" ${sel('dark', s.theme)}>${T('Dark')}</option>
              </select></label>
            <label class="field"><span>${T('Time format')}</span>
              <select id="setClock" data-setting="clock">
                <option value="12" ${sel('12', s.clock)}>${T('12-hour')} (2:30 ${lang === 'ckb' ? 'د.ن' : 'PM'})</option>
                <option value="24" ${sel('24', s.clock)}>${T('24-hour')} (14:30)</option>
              </select></label>
            <label class="field"><span>${T('Money symbol')}</span>
              <input type="text" id="setCurrency" data-setting="currency" value="${U.esc(s.currency)}" placeholder="${T('e.g.')} IQD, $, €" maxlength="6" autocomplete="off"></label>
            <label class="field"><span>${T('Week starts on')}</span>
              <select id="setWeek" data-setting="weekStart" data-num>
                <option value="6" ${sel(6, s.weekStart)}>${U.DAYS[6]}</option>
                <option value="0" ${sel(0, s.weekStart)}>${U.DAYS[0]}</option>
                <option value="1" ${sel(1, s.weekStart)}>${U.DAYS[1]}</option>
              </select></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('bell')} ${T('Reminders')}</h3></div>
          <div class="setting-row">
            <div><strong>${T('Phone / computer notifications')}</strong><p class="muted sm">${permissionLabel()}</p></div>
            <label class="switch"><input type="checkbox" id="setNotify" data-setting="notifications" ${s.notifications ? 'checked' : ''} aria-label="${T('Phone / computer notifications')}"><i></i></label>
          </div>
          <div class="setting-row">
            <div><strong>${T('Sound')}</strong></div>
            <label class="switch"><input type="checkbox" id="setSound" data-setting="sound" ${s.sound ? 'checked' : ''} aria-label="${T('Sound')}"><i></i></label>
          </div>
          <div class="setting-row">
            <div><strong>${T('Try a reminder')}</strong></div>
            <button type="button" class="btn ghost sm" data-action="test-reminder">${icon('bell', 15)}${T('Test')}</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('flame')} ${T('Extra pages')}</h3></div>
          <div class="setting-row">
            <div><strong>${T('Habits')}</strong><p class="muted sm">${T('Track daily habits like exercise or reading.')}</p></div>
            <label class="switch"><input type="checkbox" id="setHabits" data-setting="showHabits" ${s.showHabits ? 'checked' : ''} aria-label="${T('Habits')}"><i></i></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('download')} ${T('Keep your data safe')}</h3></div>
          <ul class="safety-list">
            <li class="ok">${icon('check', 15)}<span>${T('Saved on this device')}</span></li>
            <li class="${App.safety.persisted ? 'ok' : 'warn'}">${icon(App.safety.persisted ? 'check' : 'alert', 15)}
              <span>${App.safety.persisted ? T('Protected from automatic clean-up') : T('Not fully protected. Install the app to protect it.')}</span></li>
            <li class="${App.store.state.meta.lastBackup ? 'ok' : 'warn'}">${icon(App.store.state.meta.lastBackup ? 'check' : 'alert', 15)}
              <span>${T('Last backup: {when}', { when: App.safety.lastBackupText() })}</span></li>
          </ul>
          <div class="btn-row">
            <button type="button" class="btn primary" data-action="export">${icon('download', 16)}${T('Download backup')}</button>
            <label class="btn ghost file-btn">${icon('upload', 16)}${T('Restore backup')}<input type="file" id="importFile" accept="application/json,.json" hidden></label>
          </div>
          <p class="muted sm tip">${T('Save the backup file in Google Drive, iCloud or your email. To move to a new phone, open the app there and tap Restore backup.')}</p>
        </section>

        <section class="card">
          <div class="card-head"><h3>📲 ${T('Install on your phone')}</h3></div>
          ${App.safety.isInstalled() ? `<p class="safety-list ok-line">${icon('check', 15)} ${T('The app is installed.')}</p>` : `
            ${App.safety.installPrompt ? `<button type="button" class="btn primary" data-action="install-app">${icon('download', 16)}${T('Install app')}</button>` : ''}
            <ol class="install-steps">
              ${App.safety.isIOS()
                ? `<li>${T('Open this page in Safari.')}</li><li>${T('Tap the Share button (square with an arrow).')}</li><li>${T('Tap Add to Home Screen, then Add.')}</li>`
                : `<li>${T('Open this page in Chrome.')}</li><li>${T('Tap the ⋮ menu at the top.')}</li><li>${T('Tap Install app or Add to Home screen.')}</li>`}
            </ol>`}
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('trash')} ${T('Start over')}</h3></div>
          <div class="setting-row">
            <div><p class="muted sm">${T('Delete all tasks, events, habits and goals from this device.')}</p></div>
            <button type="button" class="btn ghost sm danger-text" data-action="clear-all">${icon('trash', 15)}${T('Delete everything')}</button>
          </div>
        </section>
      </div>`;
  };

  function setSetting(el) {
    const k = el.dataset.setting;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.num !== undefined) v = Number(v);
    App.store.state.settings[k] = v;
    return k;
  }

  view.onInput = function (e) {
    if (e.target.dataset.setting !== 'name' && e.target.dataset.setting !== 'currency') return;
    setSetting(e.target);
    App.store.save({ silent: true });
    App.renderChrome();
  };

  view.onChange = async function (e) {
    const el = e.target;
    if (el.dataset.setting === 'currency') {
      App.store.save();
    } else if (el.dataset.setting && el.dataset.setting !== 'name') {
      if (el.dataset.setting === 'notifications' && el.checked) {
        const ok = await App.reminders.requestPermission();
        if (!ok) {
          el.checked = false;
          App.store.state.settings.notifications = false;
          App.store.save();
          return;
        }
      }
      const k = setSetting(el);
      if (k === 'theme') App.applyTheme();
      App.store.save();
      App.ui.toast(T('Saved'));
    } else if (el.id === 'importFile' && el.files[0]) {
      const file = el.files[0];
      el.value = '';
      let data;
      try {
        data = JSON.parse(await file.text());
        if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) throw new Error('bad');
      } catch (err) {
        App.ui.toast(T('That file is not a planner backup.'), { type: 'danger' });
        return;
      }
      if (await App.ui.confirm(T('Replace everything in your planner with “{name}”?', { name: file.name }), { okText: T('Restore'), title: T('Restore backup') })) {
        App.store.replaceAll(data);
        App.applyTheme();
        App.ui.toast(T('Backup restored'));
      }
    }
  };

  view.onClick = async function (e, a) {
    if (!a) return;
    switch (a.dataset.action) {
      case 'test-reminder':
        App.reminders.fire(T('Test reminder'), T('Your reminders are working 🎉'), 'test');
        break;
      case 'export':
        App.safety.backup();
        break;
      case 'clear-all':
        if (await App.ui.confirm(T('Delete all tasks, events, habits and goals? This cannot be undone.'), { okText: T('Delete everything'), title: T('Delete everything') })) {
          App.store.reset();
          App.ui.toast(T('Everything deleted'));
        }
        break;
      default:
    }
  };

  App.views.settings = view;
})();
