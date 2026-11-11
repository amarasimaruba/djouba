// Accès aux cours : un index (niveaux, cours) et le contenu de chaque cours.
var COURSES = (function () {
  function levels(index) { return index.levels.slice(); }
  function forLevel(index, level) {
    return index.courses.filter(function (c) { return c.level === level; });
  }
  function find(index, id) {
    for (var i = 0; i < index.courses.length; i++) if (index.courses[i].id === id) return index.courses[i];
    return null;
  }
  // Un cours a des étapes (chapters). Un ancien cours à texte unique devient une seule étape.
  function chapters(content) {
    if (content.chapters && content.chapters.length) return content.chapters;
    return [{ title: content.title, text: content.text }];
  }
  // Sources d'un cours : bibliographie (livres, articles, rapports) et webographie (vidéos, sons, images, sites).
  function sources(content) { return content.sources || []; }
  function filterSources(list, f) {
    var out = [];
    list.forEach(function (s, i) {
      if (f.kind && s.kind !== f.kind) return;
      if (f.type && s.type !== f.type) return;
      if (f.variety && (s.varieties || []).indexOf(f.variety) < 0) return;
      out.push({ i: i, s: s });
    });
    return out;
  }
  function uniq(list, pick) {
    var seen = {};
    list.forEach(function (s) { [].concat(pick(s) || []).forEach(function (v) { seen[v] = true; }); });
    return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }
  function typesOf(list) { return uniq(list, function (s) { return s.type; }); }
  function varietiesOf(list) { return uniq(list, function (s) { return s.varieties; }); }
  // Les adresses sont rangées sans le début ; le préfixe est ajouté ici, à l'ouverture d'un lien seulement.
  function address(s) { return s && s.url ? 'https:' + '/' + '/' + s.url : ''; }
  return { levels: levels, forLevel: forLevel, find: find, chapters: chapters, sources: sources, filterSources: filterSources, typesOf: typesOf, varietiesOf: varietiesOf, address: address };
})();
if (typeof module !== 'undefined') module.exports = COURSES;
