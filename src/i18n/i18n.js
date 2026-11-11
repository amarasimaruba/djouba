// Langues : codes fixes fr, kr, en, es. Repli sur le français, puis sur la clé.
var I18N = (function () {
  var LANGS = ['fr', 'kr', 'en', 'es'];
  function t(dict, lang, key) {
    if (dict[lang] && dict[lang][key] != null) return dict[lang][key];
    if (dict.fr && dict.fr[key] != null) return dict.fr[key];
    return key;
  }
  function localized(obj, lang) {
    if (!obj) return '';
    if (obj[lang] != null) return obj[lang];
    return obj.fr != null ? obj.fr : '';
  }
  return { LANGS: LANGS, t: t, localized: localized };
})();
if (typeof module !== 'undefined') module.exports = I18N;
