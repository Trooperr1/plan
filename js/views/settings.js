/* Settings — name, look, reminders and backup. */
(function () {
  const App = window.App;
  const U = App.util;
  const icon = (n, s) => App.icon(n, s);

  const view = { title: 'Settings' };

  function permissionLabel() {
    if (!('Notification' in window)) return 'Not supported in this browser';
    return { granted: 'Allowed', denied: 'Blocked in browser settings', default: 'Not asked yet' }[Notification.permission];
  }

  view.render = function () {
    const s = App.store.state.settings;
    const sel = (v, cur) => (String(v) === String(cur) ? 'selected' : '');

    return `
      <div class="settings-page">
        <section class="card">
          <div class="card-head"><h3>${icon('sun')} General</h3></div>
          <div class="settings-grid">
            <label class="field"><span>Your name</span><input type="text" id="setName" data-setting="name" value="${U.esc(s.name)}" placeholder="For your greeting" maxlength="40" autocomplete="given-name"></label>
            <label class="field"><span>Theme</span>
              <select id="setTheme" data-setting="theme">
                <option value="system" ${sel('system', s.theme)}>Automatic</option>
                <option value="light" ${sel('light', s.theme)}>Light</option>
                <option value="dark" ${sel('dark', s.theme)}>Dark</option>
              </select></label>
            <label class="field"><span>Time format</span>
              <select id="setClock" data-setting="clock">
                <option value="12" ${sel('12', s.clock)}>12-hour (2:30 PM)</option>
                <option value="24" ${sel('24', s.clock)}>24-hour (14:30)</option>
              </select></label>
            <label class="field"><span>Money symbol</span>
              <input type="text" id="setCurrency" data-setting="currency" value="${U.esc(s.currency)}" placeholder="e.g. Rs, $, €" maxlength="6" autocomplete="off"></label>
            <label class="field"><span>Week starts on</span>
              <select id="setWeek" data-setting="weekStart" data-num>
                <option value="1" ${sel(1, s.weekStart)}>Monday</option>
                <option value="0" ${sel(0, s.weekStart)}>Sunday</option>
                <option value="6" ${sel(6, s.weekStart)}>Saturday</option>
              </select></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('bell')} Reminders</h3></div>
          <div class="setting-row">
            <div><strong>Phone / computer notifications</strong><p class="muted sm">${permissionLabel()}</p></div>
            <label class="switch"><input type="checkbox" id="setNotify" data-setting="notifications" ${s.notifications ? 'checked' : ''} aria-label="Notifications"><i></i></label>
          </div>
          <div class="setting-row">
            <div><strong>Sound</strong></div>
            <label class="switch"><input type="checkbox" id="setSound" data-setting="sound" ${s.sound ? 'checked' : ''} aria-label="Reminder sound"><i></i></label>
          </div>
          <div class="setting-row">
            <div><strong>Try a reminder</strong></div>
            <button type="button" class="btn ghost sm" data-action="test-reminder">${icon('bell', 15)}Test</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('flame')} Extra pages</h3></div>
          <div class="setting-row">
            <div><strong>Habits</strong><p class="muted sm">Track daily habits like exercise or reading.</p></div>
            <label class="switch"><input type="checkbox" id="setHabits" data-setting="showHabits" ${s.showHabits ? 'checked' : ''} aria-label="Show habits page"><i></i></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('download')} Keep your data safe</h3></div>
          <ul class="safety-list">
            <li class="ok">${icon('check', 15)}<span>Saved on this device</span></li>
            <li class="${App.safety.persisted ? 'ok' : 'warn'}">${icon(App.safety.persisted ? 'check' : 'alert', 15)}
              <span>${App.safety.persisted ? 'Protected from automatic clean-up' : 'Not fully protected. Install the app to protect it.'}</span></li>
            <li class="${App.store.state.meta.lastBackup ? 'ok' : 'warn'}">${icon(App.store.state.meta.lastBackup ? 'check' : 'alert', 15)}
              <span>Last backup: ${App.safety.lastBackupText()}</span></li>
          </ul>
          <div class="btn-row">
            <button type="button" class="btn primary" data-action="export">${icon('download', 16)}Download backup</button>
            <label class="btn ghost file-btn">${icon('upload', 16)}Restore backup<input type="file" id="importFile" accept="application/json,.json" hidden></label>
          </div>
          <p class="muted sm tip">Save the backup file in Google Drive, iCloud or your email. To move to a new phone, open the app there and tap <strong>Restore backup</strong>.</p>
        </section>

        <section class="card">
          <div class="card-head"><h3>📲 Install on your phone</h3></div>
          ${App.safety.isInstalled() ? `<p class="safety-list ok-line">${icon('check', 15)} The app is installed.</p>` : `
            ${App.safety.installPrompt ? `<button type="button" class="btn primary" data-action="install-app">${icon('download', 16)}Install app</button>` : ''}
            <ol class="install-steps">
              ${App.safety.isIOS()
                ? '<li>Open this page in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button (square with an arrow).</li><li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>'
                : '<li>Open this page in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮</strong> menu at the top right.</li><li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>'}
            </ol>`}
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('trash')} Start over</h3></div>
          <div class="setting-row">
            <div><p class="muted sm">Delete all tasks, events, habits and goals from this device.</p></div>
            <button type="button" class="btn ghost sm danger-text" data-action="clear-all">${icon('trash', 15)}Delete everything</button>
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
      App.ui.toast('Saved');
    } else if (el.id === 'importFile' && el.files[0]) {
      const file = el.files[0];
      el.value = '';
      let data;
      try {
        data = JSON.parse(await file.text());
        if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) throw new Error('bad');
      } catch (err) {
        App.ui.toast('That file is not a planner backup.', { type: 'danger' });
        return;
      }
      if (await App.ui.confirm(`Replace everything in your planner with “${file.name}”?`, { okText: 'Restore', title: 'Restore backup' })) {
        App.store.replaceAll(data);
        App.applyTheme();
        App.ui.toast('Backup restored');
      }
    }
  };

  view.onClick = async function (e, a) {
    if (!a) return;
    switch (a.dataset.action) {
      case 'test-reminder':
        App.reminders.fire('Test reminder', 'Your reminders are working 🎉', 'test');
        break;
      case 'export':
        App.safety.backup();
        break;
      case 'clear-all':
        if (await App.ui.confirm('Delete all tasks, events, habits and goals? This cannot be undone.', { okText: 'Delete everything', title: 'Delete everything' })) {
          App.store.reset();
          App.ui.toast('Everything deleted');
        }
        break;
      default:
    }
  };

  App.views.settings = view;
})();
