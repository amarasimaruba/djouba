/* Contrôles bloquants exécutés par build.js : le build échoue si l'un d'eux échoue. */
var CORE = require('./core.js');
var CONTENT = require('./content.js');

function run(sources) {
  var errors = CORE.lint(CONTENT);

  // Chaque bonne réponse doit être acceptée par son validateur (et une mauvaise refusée).
  CONTENT.objects.forEach(function (o) {
    o.parts.forEach(function (p) {
      var where = o.id + '.' + p.id;
      if (!CORE.validate.single(p.id, p.id)) errors.push('Validateur « choix » refuse la bonne réponse : ' + where);
      if (!CORE.validate.point(o, p.a[0], p.a[1], p.id)) errors.push('Validateur « clic » refuse la bonne réponse : ' + where);
      o.parts.forEach(function (q) {
        if (q.id !== p.id && CORE.validate.single(q.id, p.id)) errors.push('Validateur accepte une mauvaise réponse : ' + where);
      });
      CORE.LANG_IDS.forEach(function (l) {
        if (!CORE.firstLetter(CORE.tr(p.name, l), l)) errors.push('Aide « première lettre » vide [' + l + '] : ' + where);
      });
    });
    CORE.LANG_IDS.forEach(function (l) {
      for (var seed = 1; seed <= 20; seed++) {
        var q = CORE.buildCheckQuestion(CONTENT.objects, o.id, l, CORE.rng(seed));
        if (!CORE.validate.multi(q.answer.slice(), q.answer)) errors.push('Validateur QCM refuse la bonne réponse : ' + o.id);
        var names = q.options.map(function (x) { return CORE.tr(x.name, l); });
        if (names.length !== new Set(names).size) errors.push('QCM avec deux options identiques [' + l + '] : ' + o.id + ' (graine ' + seed + ')');
        if (q.options.filter(function (x) { return !x.good; }).length < 2) errors.push('QCM avec moins de 2 intrus : ' + o.id);
      }
    });
  });

  // Fichiers sources : rien qui casse le script en ligne, aucun accès réseau.
  Object.keys(sources).forEach(function (name) {
    var src = sources[name];
    if (/<\/script/i.test(src)) errors.push('« </script » interdit dans ' + name);
    if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\s*\(/.test(src) || /new\s+(XMLHttpRequest|WebSocket|EventSource)/.test(src)) errors.push('Appel réseau interdit dans ' + name);
    var urls = (src.match(/https?:\/\/[^\s'")]+/g) || []).filter(function (u) { return u.indexOf('http://www.w3.org/2000/svg') !== 0; });
    if (urls.length) errors.push('Adresse externe dans ' + name + ' : ' + urls.join(', '));
    if (/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(src)) errors.push('HTML injecté interdit (utiliser textContent) dans ' + name);
  });
  return errors;
}
module.exports = { run: run };
