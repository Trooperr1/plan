/* Language support. App.t('English text', { vars }) returns the text in the chosen language.
   Kurdish (Sorani) words live in js/lang-ckb.js. */
(function () {
  const App = window.App;
  const LANGS = { en: { name: 'English', dir: 'ltr' }, ckb: { name: 'کوردی (سۆرانی)', dir: 'rtl' } };
  const missing = new Set();

  function lang() {
    const s = App.store && App.store.state && App.store.state.settings;
    return s && LANGS[s.lang] ? s.lang : 'ckb';
  }

  function t(text, vars) {
    let out = text;
    if (lang() === 'ckb') {
      const hit = (App.dictCkb || {})[text];
      if (hit) out = hit;
      else missing.add(text);
    }
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return out;
  }

  /* Put the page in the chosen language and direction (Kurdish reads right to left). */
  function apply() {
    const l = lang();
    document.documentElement.lang = l;
    document.documentElement.dir = LANGS[l].dir;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-title]').forEach((el) => { el.title = t(el.dataset.tTitle); });
    document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
  }

  App.i18n = { LANGS, lang, apply, missing };
  App.t = t;
})();
