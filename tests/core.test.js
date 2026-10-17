/* Tests du noyau. */
var assert = require('assert');
var K = require('../src/core.js');
var passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }

test('tr : repli sur le français', function () {
  assert.strictEqual(K.tr({ fr: 'a', ht: '', en: 'b', es: 'c' }, 'ht'), 'a');
  assert.strictEqual(K.tr({ fr: 'a', ht: 'x', en: 'b', es: 'c' }, 'en'), 'b');
});
test('fmt remplace les variables', function () {
  assert.strictEqual(K.fmt('{n} / {total}', { n: 2, total: 5 }), '2 / 5');
});
test('firstLetter ignore l\'article', function () {
  assert.strictEqual(K.firstLetter('la poignée', 'fr'), 'P');
  assert.strictEqual(K.firstLetter('l\'abat-jour', 'fr'), 'A');
  assert.strictEqual(K.firstLetter('el colchón', 'es'), 'C');
  assert.strictEqual(K.firstLetter('the bulb', 'en'), 'B');
  assert.strictEqual(K.firstLetter('matla a', 'ht'), 'M');
});
test('moteur d\'essais : aide 1, aide 2, puis solution', function () {
  var a = K.createAttempt();
  assert.strictEqual(K.canShowSolution(a), false);
  assert.strictEqual(K.submitAttempt(a, false).status, 'hint1');
  assert.strictEqual(K.canShowSolution(a), false);
  assert.strictEqual(K.submitAttempt(a, false).status, 'hint2');
  assert.strictEqual(K.canShowSolution(a), false);
  assert.strictEqual(K.submitAttempt(a, false).status, 'solution');
  assert.strictEqual(K.canShowSolution(a), true);
  assert.strictEqual(K.submitAttempt(a, true).status, 'solution', 'une réponse après la solution ne compte pas');
});
test('moteur d\'essais : réussite du premier coup', function () {
  var a = K.createAttempt();
  var r = K.submitAttempt(a, true);
  assert.strictEqual(r.status, 'correct');
  assert.strictEqual(a.firstTry, true);
  var b = K.createAttempt(); K.submitAttempt(b, false); K.submitAttempt(b, true);
  assert.strictEqual(b.firstTry, false);
});
test('validateurs', function () {
  assert.ok(K.validate.single('a', 'a'));
  assert.ok(!K.validate.single('', 'a'));
  assert.ok(!K.validate.single(null, 'a'));
  assert.ok(K.validate.multi(['b', 'a'], ['a', 'b']));
  assert.ok(!K.validate.multi(['a'], ['a', 'b']));
  assert.ok(!K.validate.multi(['a', 'c'], ['a', 'b']));
});
test('géométrie : rectangle, cercle, polygone, ligne', function () {
  assert.ok(K.shapeContains({ t: 'rect', x: 0, y: 0, w: 10, h: 10 }, 5, 5));
  assert.ok(!K.shapeContains({ t: 'rect', x: 0, y: 0, w: 10, h: 10 }, 11, 5));
  assert.ok(K.shapeContains({ t: 'circle', cx: 0, cy: 0, r: 5 }, 3, 3));
  assert.ok(!K.shapeContains({ t: 'circle', cx: 0, cy: 0, r: 5 }, 4, 4));
  var tri = { t: 'poly', pts: [[0, 10], [5, 0], [10, 10]] };
  assert.ok(K.shapeContains(tri, 5, 8));
  assert.ok(!K.shapeContains(tri, 1, 1));
  assert.ok(K.shapeContains({ t: 'line', pts: [[0, 0], [10, 0]] }, 5, 1, 4));
  assert.ok(!K.shapeContains({ t: 'line', pts: [[0, 0], [10, 0]] }, 5, 6, 4));
});
test('partAt renvoie la partie dessinée au-dessus', function () {
  var o = { parts: [{ id: 'fond', shapes: [{ t: 'rect', x: 0, y: 0, w: 100, h: 100 }] }, { id: 'dessus', shapes: [{ t: 'rect', x: 10, y: 10, w: 10, h: 10 }] }] };
  assert.strictEqual(K.partAt(o, 15, 15), 'dessus');
  assert.strictEqual(K.partAt(o, 50, 50), 'fond');
  assert.strictEqual(K.partAt(o, 150, 50), null);
});
test('contraste : texte noir ou blanc selon la luminance', function () {
  assert.strictEqual(K.textOn('#FFFFFF'), '#000000');
  assert.strictEqual(K.textOn('#000000'), '#FFFFFF');
  assert.ok(Math.abs(K.contrastRatio('#000000', '#FFFFFF') - 21) < 0.01);
});
test('ZIP : aller-retour et CRC', function () {
  assert.strictEqual(K.crc32(K.utf8('123456789')), 0xCBF43926);
  var z = K.makeZip([{ name: 'a.json', data: '{"é":1}' }, { name: 'b.txt', data: 'bonjour' }]);
  var files = K.readZip(z);
  assert.strictEqual(files.length, 2);
  assert.strictEqual(K.fromUtf8(files[0].data), '{"é":1}');
  assert.strictEqual(files[1].name, 'b.txt');
  z[z.length - 30] ^= 0xFF; // abîmer les données
  var bad = K.makeZip([{ name: 'x', data: 'abc' }]); bad[33] ^= 0xFF;
  assert.throws(function () { K.readZip(bad); });
  assert.throws(function () { K.readZip(new Uint8Array([1, 2, 3])); });
});
test('CSV : séparateur, guillemets et formules neutralisées', function () {
  var csv = K.toCsv([['a;b', '=1+1', 'x"y']]);
  assert.strictEqual(csv, '﻿"a;b";\'=1+1;"x""y"');
});
test('sanitizeState refuse les sauvegardes invalides', function () {
  assert.strictEqual(K.sanitizeState(null), null);
  assert.strictEqual(K.sanitizeState({ version: 2 }), null);
  var s = K.sanitizeState({ version: 1, lang: 'xx', view: 'map', current: 'zz', profiles: [{ id: 'p1', pseudo: 'Léa' }], settings: { size: 'huge', dyslexia: 1 } });
  assert.strictEqual(s.lang, 'fr');
  assert.strictEqual(s.view, 'map');
  assert.strictEqual(s.current, 'p1');
  assert.strictEqual(s.settings.size, 'normal');
  assert.strictEqual(s.settings.dyslexia, true);
});
test('stockage mémoire (repli sans IndexedDB)', function () {
  return K.openStore('test').then(function (s) {
    assert.strictEqual(s.kind, 'memory');
  });
});
test('shuffle reproductible et complet', function () {
  var a = K.shuffle([1, 2, 3, 4, 5], K.rng(42)), b = K.shuffle([1, 2, 3, 4, 5], K.rng(42));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a.slice().sort(), [1, 2, 3, 4, 5]);
});
console.log('core : ' + passed + ' tests réussis');
