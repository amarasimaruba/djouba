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
  return { levels: levels, forLevel: forLevel, find: find, chapters: chapters };
})();
if (typeof module !== 'undefined') module.exports = COURSES;
