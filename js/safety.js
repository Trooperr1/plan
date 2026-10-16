/* Keeping data safe: permanent storage, backups and installing the app. */
(function () {
  const App = window.App;
  const U = App.util;
  const DAY = 86400000;

  const safety = {
    persisted: null, // true / false once the browser answers, null if unknown
    installPrompt: null, // Android/desktop Chrome "Install app" prompt, when offered

    /* Ask the browser not to clear our data automatically. */
    protect() {
      if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
      return navigator.storage.persisted()
        .then((p) => (p ? true : navigator.storage.persist()))
        .then((p) => { safety.persisted = !!p; return p; })
        .catch(() => null);
    },

    isInstalled() {
      return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    },

    isIOS() {
      return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },

    async install() {
      if (!safety.installPrompt) return false;
      safety.installPrompt.prompt();
      const choice = await safety.installPrompt.userChoice.catch(() => null);
      safety.installPrompt = null;
      return choice && choice.outcome === 'accepted';
    },

    /* Download everything as a backup file. */
    backup() {
      const st = App.store.state;
      st.meta.lastBackup = Date.now();
      st.meta.backupSnooze = null;
      const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-planner-backup-${U.todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      App.ui.toast('Backup downloaded. Keep the file somewhere safe, like Google Drive or email.', { duration: 6000 });
      App.store.save();
    },

    /* Remind about a backup when there is something to lose and the last one is 14+ days old. */
    backupDue() {
      const st = App.store.state;
      const m = st.meta;
      const items = st.tasks.length + st.events.length + st.goals.length + st.habits.length;
      if (items < 3) return false;
      if (m.backupSnooze && Date.now() < m.backupSnooze) return false;
      return Date.now() - (m.lastBackup || m.createdAt) > 14 * DAY;
    },

    snoozeBackup() {
      App.store.state.meta.backupSnooze = Date.now() + 3 * DAY;
      App.store.save();
    },

    lastBackupText() {
      const t = App.store.state.meta.lastBackup;
      return t ? U.agoDays(t) : 'never';
    },

    showInstallTip() {
      return !safety.isInstalled() && !App.store.state.meta.installTipDismissed;
    },
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    safety.installPrompt = e;
    if (App.render) App.render();
  });

  App.safety = safety;
})();
