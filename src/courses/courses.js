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
  return { levels: levels, forLevel: forLevel, find: find };
})();
if (typeof module !== 'undefined') module.exports = COURSES;
