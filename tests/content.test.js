/* Tests du contenu : recalculs indépendants et tests de mutation du linter. */
var assert = require('assert');
var C = require('../src/content.js');
var K = require('../src/core.js');
var passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

test('le linter ne signale rien sur le contenu livré', function () {
  assert.deepStrictEqual(K.lint(C), []);
});
test('6 objets, 4 à 8 parties chacun, 4 langues', function () {
  assert.strictEqual(C.objects.length, 6);
  C.objects.forEach(function (o) { assert.ok(o.parts.length >= 4 && o.parts.length <= 8, o.id); });
  assert.deepStrictEqual(C.langs.map(function (l) { return l.id; }), ['fr', 'ht', 'en', 'es']);
});
test('contraste ≥ 4,5:1 recalculé indépendamment (formule WCAG)', function () {
  function rl(hex) {
    var v = [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; })
      .map(function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  C.objects.forEach(function (o) {
    var L = rl(o.color);
    var best = Math.max((1.05) / (L + 0.05), (L + 0.05) / 0.05);
    assert.ok(best >= 4.5, o.id + ' : ' + best.toFixed(2));
  });
});
test('chaque flèche vise un point visible de sa partie (échantillonnage indépendant)', function () {
  // On vérifie aussi qu'un petit voisinage (±2) autour du point reste dans la partie : la flèche ne vise pas un bord.
  C.objects.forEach(function (o) {
    o.parts.forEach(function (p) {
      var ok = 0;
      [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (d) { if (K.partAt(o, p.a[0] + d[0], p.a[1] + d[1]) === p.id) ok++; });
      assert.ok(ok >= 4, o.id + '.' + p.id + ' vise trop près d\'un bord (' + ok + '/5)');
    });
  });
});
test('étiquettes : au moins 26 unités entre deux étiquettes d\'un même côté', function () {
  C.objects.forEach(function (o) {
    var lay = K.layoutLabels(o, C.viewBox);
    ['left', 'right'].forEach(function (side) {
      var ys = lay.filter(function (l) { return l.side === side; }).map(function (l) { return l.ly; }).sort(function (a, b) { return a - b; });
      for (var i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 26, o.id + ' ' + side);
    });
    assert.strictEqual(lay.length, o.parts.length);
  });
});
test('les définitions ne donnent pas le mot à trouver', function () {
  C.objects.forEach(function (o) {
    o.parts.forEach(function (p) {
      var w = p.name.fr.replace(/^(le |la |les |l')/, '').toLowerCase();
      assert.ok(p.def.fr.toLowerCase().indexOf(w) === -1, o.id + '.' + p.id);
    });
  });
});
test('mutation : traduction manquante détectée', function () {
  var m = clone(C); m.objects[0].parts[0].name.ht = '';
  assert.ok(K.lint(m).some(function (e) { return /Traduction manquante \[ht\]/.test(e); }));
});
test('mutation : flèche sur une partie cachée détectée', function () {
  var m = clone(C); m.objects[0].parts[0].a = [230, 100]; // la cheminée visée sous le toit
  assert.ok(K.lint(m).some(function (e) { return /pointe sur toit/.test(e); }));
});
test('mutation : identifiant en double détecté', function () {
  var m = clone(C); m.objects[1].parts[1].id = m.objects[1].parts[0].id;
  assert.ok(K.lint(m).some(function (e) { return /double/.test(e); }));
});
test('mutation : idée reçue non cadrée détectée', function () {
  var m = clone(C); m.objects[2].misconception.fr = 'Attention à la vitre.';
  assert.ok(K.lint(m).some(function (e) { return /Croire que/.test(e); }));
});
test('mutation : nom sans article détecté', function () {
  var m = clone(C); m.objects[3].parts[0].name.fr = 'pieds';
  assert.ok(K.lint(m).some(function (e) { return /article/.test(e); }));
});
test('mutation : couleur trop peu contrastée détectée', function () {
  var m = clone(C); m.objects[0].color = '#FFEB3B';
  assert.ok(K.lint(m).some(function (e) { return /Contraste/.test(e); }));
});
test('QCM : intrus jamais homonymes d\'une vraie partie, dans les 4 langues', function () {
  C.objects.forEach(function (o) {
    K.LANG_IDS.forEach(function (l) {
      for (var s = 1; s < 50; s++) {
        var q = K.buildCheckQuestion(C.objects, o.id, l, K.rng(s));
        var own = o.parts.map(function (p) { return K.tr(p.name, l); });
        q.options.filter(function (x) { return !x.good; }).forEach(function (x) {
          assert.ok(own.indexOf(K.tr(x.name, l)) === -1, o.id + ' ' + l + ' ' + K.tr(x.name, l));
        });
      }
    });
  });
});
var words = 0;
C.objects.forEach(function (o) { words += o.parts.length; });
console.log('content : ' + passed + ' tests réussis (' + words + ' mots de vocabulaire × 4 langues)');
