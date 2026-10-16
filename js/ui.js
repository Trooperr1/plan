/* Modal dialogs, confirm prompts and toast notifications. */
(function () {
  const App = window.App;
  const U = App.util;
  const stack = [];

  function modal({ title, body, footer, onMount, size }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${size || ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
        <div class="modal-head">
          <h2>${U.esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="${App.t('Close')}">${App.icon('x')}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    const prevFocus = document.activeElement;
    const api = { el: wrap.querySelector('.modal'), close };

    function close() {
      if (!wrap.isConnected) return;
      wrap.classList.add('closing');
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      setTimeout(() => wrap.remove(), 140);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      if (api.onClose) api.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape' && stack[stack.length - 1] === api) {
        e.preventDefault();
        close();
      }
    }

    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap) close();
    });
    wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    document.addEventListener('keydown', onKey);
    document.getElementById('modalRoot').appendChild(wrap);
    stack.push(api);
    if (onMount) onMount(api.el, api);
    const first = api.el.querySelector('[autofocus]') || api.el.querySelector('.modal-body input, .modal-body select, .modal-body textarea, .modal-foot .btn.primary');
    if (first) setTimeout(() => first.focus(), 40);
    return api;
  }

  function confirm(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let answered = false;
      const m = modal({
        title: opts.title || App.t('Are you sure?'),
        size: 'sm',
        body: `<p class="confirm-text">${U.esc(message)}</p>`,
        footer: `<button type="button" class="btn ghost" data-close>${App.t('Cancel')}</button>
                 <button type="button" class="btn ${opts.danger === false ? 'primary' : 'danger'}" data-ok>${U.esc(opts.okText || App.t('Delete'))}</button>`,
        onMount(el) {
          el.querySelector('[data-ok]').addEventListener('click', () => {
            answered = true;
            m.close();
            resolve(true);
          });
        },
      });
      m.onClose = () => {
        if (!answered) resolve(false);
      };
    });
  }

  function toast(message, opts) {
    opts = opts || {};
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast ${opts.type || ''}`;
    el.setAttribute('role', opts.type === 'danger' ? 'alert' : 'status');
    el.innerHTML = `
      <span class="toast-icon">${App.icon(opts.icon || (opts.type === 'danger' ? 'alert' : 'check'), 18)}</span>
      <div class="toast-msg">${opts.html ? message : U.esc(message)}</div>
      ${opts.action ? `<button type="button" class="btn sm ghost toast-action">${U.esc(opts.action.label)}</button>` : ''}
      <button type="button" class="icon-btn sm toast-close" aria-label="${App.t('Close')}">${App.icon('x', 14)}</button>`;
    const remove = () => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    if (opts.action) {
      el.querySelector('.toast-action').addEventListener('click', () => {
        opts.action.fn();
        remove();
      });
    }
    box.appendChild(el);
    while (box.children.length > 4) box.firstElementChild.remove();
    setTimeout(remove, opts.duration || 3500);
  }

  App.ui = {
    modal,
    confirm,
    toast,
    get modalOpen() { return stack.length > 0; },
  };
})();
