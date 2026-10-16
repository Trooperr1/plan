/* Settings — profile, appearance, reminders, categories and backup. */
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
    const st = App.store.state;
    const s = st.settings;
    const sel = (v, cur) => (String(v) === String(cur) ? 'selected' : '');
    const counts = `${st.tasks.length} tasks · ${st.events.length} events · ${st.habits.length} habits · ${st.goals.length} goals`;

    return `
      <div class="settings-page">
        <section class="card">
          <div class="card-head"><h3>${icon('sun')} Profile & appearance</h3></div>
          <div class="settings-grid">
            <label class="field"><span>Your name</span><input type="text" data-setting="name" value="${U.esc(s.name)}" placeholder="Used in your daily greeting" maxlength="40" autocomplete="given-name"></label>
            <label class="field"><span>Theme</span>
              <select data-setting="theme">
                <option value="system" ${sel('system', s.theme)}>Match device</option>
                <option value="light" ${sel('light', s.theme)}>Light</option>
                <option value="dark" ${sel('dark', s.theme)}>Dark</option>
              </select></label>
            <label class="field"><span>Week starts on</span>
              <select data-setting="weekStart" data-num>
                <option value="1" ${sel(1, s.weekStart)}>Monday</option>
                <option value="0" ${sel(0, s.weekStart)}>Sunday</option>
                <option value="6" ${sel(6, s.weekStart)}>Saturday</option>
              </select></label>
            <label class="field"><span>Time format</span>
              <select data-setting="clock">
                <option value="12" ${sel('12', s.clock)}>12-hour (2:30 PM)</option>
                <option value="24" ${sel('24', s.clock)}>24-hour (14:30)</option>
              </select></label>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('bell')} Reminders</h3></div>
          <div class="setting-row">
            <div><strong>Desktop / phone notifications</strong><p class="muted sm">Status: ${permissionLabel()}. Reminders also appear inside the app.</p></div>
            <label class="switch"><input type="checkbox" data-setting="notifications" ${s.notifications ? 'checked' : ''} aria-label="Enable notifications"><i></i></label>
          </div>
          <div class="setting-row">
            <div><strong>Reminder sound</strong><p class="muted sm">Play a short chime when a reminder fires.</p></div>
            <label class="switch"><input type="checkbox" data-setting="sound" ${s.sound ? 'checked' : ''} aria-label="Reminder sound"><i></i></label>
          </div>
          <div class="setting-row">
            <div><strong>Default reminder</strong><p class="muted sm">Used for new events and quick-added tasks with a time.</p></div>
            <select data-setting="defaultReminder" data-num aria-label="Default reminder">
              ${App.sched.REMINDERS.filter(([v]) => v != null).map(([v, l]) => `<option value="${v}" ${sel(v, s.defaultReminder)}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="setting-row">
            <div><strong>Test it</strong><p class="muted sm">Keep this app open (or installed) so reminders can fire on time.</p></div>
            <button type="button" class="btn ghost" data-action="test-reminder">${icon('bell', 16)}Send test reminder</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('grid')} Categories</h3></div>
          <div class="cat-list">
            ${st.categories.map((c) => `
              <div class="cat-row">
                <input type="color" value="${U.esc(c.color)}" data-cat-color="${c.id}" aria-label="Color for ${U.esc(c.name)}">
                <input type="text" value="${U.esc(c.name)}" data-cat-name="${c.id}" maxlength="24" aria-label="Category name">
                <button type="button" class="icon-btn" data-action="del-cat" data-id="${c.id}" aria-label="Delete category" ${st.categories.length <= 1 ? 'disabled' : ''}>${icon('trash', 16)}</button>
              </div>`).join('')}
          </div>
          <form class="cat-add" data-cat-add>
            <input type="color" id="newCatColor" value="#14b8a6" aria-label="New category color">
            <input type="text" id="newCatName" placeholder="New category name" maxlength="24" autocomplete="off">
            <button type="submit" class="btn ghost sm">${icon('plus', 14)}Add</button>
          </form>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('download')} Your data</h3><span class="muted sm">${counts}</span></div>
          <p class="muted sm">Everything is stored privately in this browser on this device. Export a backup regularly, and import it to move to another phone or computer.</p>
          <div class="btn-row">
            <button type="button" class="btn primary" data-action="export">${icon('download', 16)}Export backup</button>
            <label class="btn ghost file-btn">${icon('upload', 16)}Import backup<input type="file" id="importFile" accept="application/json,.json" hidden></label>
            <button type="button" class="btn ghost" data-action="add-samples">${icon('star', 16)}Add sample data</button>
            <button type="button" class="btn ghost danger-text" data-action="clear-all">${icon('trash', 16)}Erase everything</button>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h3>${icon('keyboard')} Keyboard shortcuts & tips</h3></div>
          <ul class="shortcuts">
            <li><kbd>N</kbd> New task</li>
            <li><kbd>E</kbd> New event</li>
            <li><kbd>1</kbd>–<kbd>6</kbd> Switch pages</li>
            <li><kbd>Esc</kbd> Close dialog</li>
          </ul>
          <p class="muted sm">Quick add understands times, categories and priority — e.g. <code>Doctor at 4:30pm #health !high</code>.
          Install the app from your browser menu (“Add to Home screen” / “Install app”) to use it offline like a native app.</p>
        </section>
      </div>`;
  };

  function setSetting(el) {
    const st = App.store.state;
    const k = el.dataset.setting;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.num !== undefined) v = Number(v);
    st.settings[k] = v;
    return k;
  }

  view.onInput = function (e) {
    const el = e.target;
    const st = App.store.state;
    if (el.dataset.setting === 'name') {
      setSetting(el);
      App.store.save({ silent: true });
      App.renderChrome();
    } else if (el.dataset.catName) {
      const c = st.categories.find((x) => x.id === el.dataset.catName);
      if (c && el.value.trim()) {
        c.name = el.value.trim();
        App.store.save({ silent: true });
      }
    } else if (el.dataset.catColor) {
      const c = st.categories.find((x) => x.id === el.dataset.catColor);
      if (c) {
        c.color = el.value;
        App.store.save({ silent: true });
      }
    }
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
      App.ui.toast('Settings saved');
    } else if (el.dataset.catName || el.dataset.catColor) {
      App.store.save(); // re-render with the final value
    } else if (el.id === 'importFile' && el.files[0]) {
      const file = el.files[0];
      el.value = '';
      let data;
      try {
        data = JSON.parse(await file.text());
        if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) throw new Error('bad');
      } catch (err) {
        App.ui.toast('That file is not a valid planner backup.', { type: 'danger' });
        return;
      }
      if (await App.ui.confirm(`Replace your current data with “${file.name}”? Export first if you want to keep what you have.`, { okText: 'Import', title: 'Import backup' })) {
        App.store.replaceAll(data);
        App.applyTheme();
        App.ui.toast('Backup imported');
      }
    }
  };

  view.onSubmit = function (e) {
    if (!e.target.matches('[data-cat-add]')) return;
    e.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    if (!name) return;
    const st = App.store.state;
    st.categories.push({ id: U.uid(), name, color: document.getElementById('newCatColor').value });
    App.store.save();
    App.ui.toast(`Category “${name}” added`);
  };

  view.onClick = async function (e, a) {
    if (!a) return;
    const st = App.store.state;
    switch (a.dataset.action) {
      case 'test-reminder':
        App.reminders.fire('Test reminder', 'Your reminders are working 🎉', 'test');
        break;
      case 'del-cat': {
        const c = st.categories.find((x) => x.id === a.dataset.id);
        if (!c || st.categories.length <= 1) return;
        const used = [...st.tasks, ...st.events, ...st.goals].filter((x) => x.category === c.id).length;
        const msg = used ? `Delete “${c.name}”? ${used} item${used === 1 ? '' : 's'} will move to “${st.categories.find((x) => x.id !== c.id).name}”.` : `Delete “${c.name}”?`;
        if (!(await App.ui.confirm(msg))) return;
        st.categories = st.categories.filter((x) => x.id !== c.id);
        const to = st.categories[0].id;
        [...st.tasks, ...st.events, ...st.goals].forEach((x) => { if (x.category === c.id) x.category = to; });
        App.store.save();
        break;
      }
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
      case 'add-samples':
        if (await App.ui.confirm('Add example tasks, events, habits and goals to your planner?', { okText: 'Add samples', danger: false, title: 'Sample data' })) {
          App.store.addSamples();
          App.ui.toast('Sample data added');
        }
        break;
      case 'clear-all':
        if (await App.ui.confirm('Erase all tasks, events, habits, goals and notes? Your settings are kept. This cannot be undone.', { okText: 'Erase everything', title: 'Erase all data' })) {
          App.store.reset();
          App.ui.toast('All data erased');
        }
        break;
      default:
    }
  };

  App.views.settings = view;
})();
