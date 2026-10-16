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
          <div class="card-head"><h3>${icon('download')} Backup</h3></div>
          <p class="muted sm">Your planner is saved on this device. Download a backup to keep it safe or move it to another phone.</p>
          <div class="btn-row">
            <button type="button" class="btn primary" data-action="export">${icon('download', 16)}Download backup</button>
            <label class="btn ghost file-btn">${icon('upload', 16)}Restore backup<input type="file" id="importFile" accept="application/json,.json" hidden></label>
            <button type="button" class="btn ghost danger-text" data-action="clear-all">${icon('trash', 16)}Delete everything</button>
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
    if (e.target.dataset.setting !== 'name') return;
    setSetting(e.target);
    App.store.save({ silent: true });
    App.renderChrome();
  };

  view.onChange = async function (e) {
    const el = e.target;
    if (el.dataset.setting && el.dataset.setting !== 'name') {
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
    const st = App.store.state;
    switch (a.dataset.action) {
      case 'test-reminder':
        App.reminders.fire('Test reminder', 'Your reminders are working 🎉', 'test');
        break;
      case 'export': {
        const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `daily-planner-backup-${U.todayKey()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        App.ui.toast('Backup downloaded');
        break;
      }
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
