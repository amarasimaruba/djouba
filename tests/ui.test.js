/* Tests d'interface dans jsdom + audit axe-core (le contraste est vérifié dans le vrai navigateur). */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var JSDOM = require('jsdom').JSDOM;
var axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'dictionnaire-visuel-maison.html'), 'utf8');

var errors = [];
var dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
var w = dom.window, d = w.document;
w.addEventListener('error', function (e) { errors.push(e.message); });
var passed = 0;
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); }
function $(s) { return d.querySelector(s); }
function $$(s) { return Array.prototype.slice.call(d.querySelectorAll(s)); }
function change(sel, v) { var e = $(sel); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); }
function click(e) { e.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
async function axe(label) {
  if (!w.axe) w.eval(axeSrc);
  var res = await w.axe.run(d, { rules: { 'color-contrast': { enabled: false } } });
  var v = res.violations.map(function (x) { return x.id + ' (' + x.nodes.length + ') ' + x.nodes.slice(0, 2).map(function (n) { return n.target.join(' '); }).join(' | '); });
  assert.strictEqual(v.length, 0, 'axe [' + label + '] : ' + v.join('; '));
  console.log('  ✓ axe sans violation : ' + label);
}
async function test(name, fn) { await fn(); passed++; console.log('  ✓ ' + name); }

(async function () {
  await wait(80);
  var C = w.CONTENT, K = w.CORE;

  await test('démarrage : titre, 4 langues, 3 affichages, aucune erreur', async function () {
    assert.strictEqual($('h1').textContent, 'Mon dictionnaire visuel : la maison');
    assert.strictEqual($$('#langsel option').length, 4);
    assert.strictEqual($$('#viewsel option').length, 3);
    assert.strictEqual($('#objtitle').textContent, 'la maison');
    assert.deepStrictEqual(errors, []);
  });

  await test('découvrir : toutes les parties sont nommées et fléchées', async function () {
    var o = C.objects[0];
    assert.strictEqual($$('.plate .label').length, o.parts.length);
    assert.strictEqual($$('.plate .label line[marker-end]').length, o.parts.length);
    click($('#pl-toit'));
    assert.ok($('.defcard').textContent.indexOf('le toit') !== -1);
    assert.ok($('.defcard').textContent.indexOf('protège de la pluie') !== -1);
    assert.ok($('g.part[data-part="toit"]').classList.contains('hl'));
    assert.strictEqual(w.APP.state().progress.p1.maison.seen, true);
  });
  await axe('découvrir');

  await test('montre-moi : aide 1, aide 2, solution seulement au 3e échec', async function () {
    change('#actsel', 'show');
    var s = w.APP.session(), o = C.objects[0], target = s.questions[0];
    var wrong = o.parts.filter(function (p) { return p.id !== target; })[0].id;
    assert.strictEqual($$('.plate .label').length, 0, 'pas d\'étiquette avant la réponse');
    click($('g.part[data-part="' + wrong + '"]'));
    assert.ok($('.feedback').textContent.indexOf('Voici une aide') !== -1);
    assert.ok(/Regarde vers/.test($('.feedback').textContent));
    assert.strictEqual($$('.plate .label').length, 0);
    assert.ok(!$('#nextq'));
    click($('g.part[data-part="' + wrong + '"]'));
    assert.ok(/Deuxième aide/.test($('.feedback').textContent));
    assert.ok(/Indice/.test($('.feedback').textContent));
    assert.strictEqual($$('.plate .label').length, 0);
    click($('g.part[data-part="' + wrong + '"]'));
    assert.ok(/La réponse était/.test($('.feedback').textContent));
    assert.strictEqual($$('.plate .label').length, 1);
    assert.strictEqual($('.plate .label text').textContent, K.tr(K.findPart(o, target).name, 'fr'));
    assert.ok($('#nextq'));
  });
  await axe('montre-moi (solution)');

  await test('montre-moi : activité complète, score du premier coup enregistré', async function () {
    click($('#nextq'));
    var s = w.APP.session();
    while (!s.done) {
      click($('g.part[data-part="' + s.questions[s.idx] + '"]'));
      assert.ok(/Bravo/.test($('.feedback').textContent));
      click($('#nextq'));
    }
    var n = C.objects[0].parts.length;
    assert.strictEqual(JSON.stringify(w.APP.state().progress.p1.maison.show), JSON.stringify({ done: true, score: n - 1, total: n }));
    assert.ok(/Croire que le toit et le plafond/.test($('.misconception').textContent));
  });
  await axe('fin d\'activité');

  await test('nomme la flèche : menu déroulant, « ? » puis aide avec définition', async function () {
    change('#actsel', 'arrow');
    var s = w.APP.session(), o = C.objects[0], target = s.questions[0];
    assert.strictEqual($('.plate .label text').textContent, '?');
    assert.strictEqual($$('#arrowsel option').length, o.parts.length + 1);
    click($('#validate'));
    assert.ok(/Choisis d'abord/.test($('.feedback').textContent));
    assert.strictEqual(s.att.fails, 0, 'une absence de réponse ne compte pas comme un essai');
    var wrong = o.parts.filter(function (p) { return p.id !== target; })[0].id;
    change('#arrowsel', wrong); click($('#validate'));
    assert.ok($('.feedback').textContent.indexOf(K.tr(K.findPart(o, target).def, 'fr')) !== -1);
    change('#arrowsel', target); click($('#validate'));
    assert.ok(/Bravo/.test($('.feedback').textContent));
    assert.strictEqual($('.plate .label text').textContent, K.tr(K.findPart(o, target).name, 'fr'));
  });
  await axe('nomme la flèche');

  await test('QCM : vraies cases à cocher, 2 aides, puis correction', async function () {
    change('#actsel', 'check');
    var s = w.APP.session();
    var boxes = $$('.qcm input[type=checkbox]');
    assert.ok(boxes.length >= 6);
    var intruder = s.check.options.findIndex(function (o) { return !o.good; });
    function tick(i, on) { var b = $('#cb' + i); b.checked = on; b.dispatchEvent(new w.Event('change', { bubbles: true })); }
    tick(intruder, true); click($('#validate'));
    assert.ok(/Il y a 4 bonnes réponses/.test($('.feedback').textContent));
    tick(intruder, true); click($('#validate'));
    assert.ok(/est une partie de/.test($('.feedback').textContent));
    s.check.options.forEach(function (o, i) { tick(i, o.good); });
    click($('#validate'));
    assert.ok(/Bravo/.test($('.feedback').textContent));
    assert.ok($$('.cbrow.good').length === 4);
    assert.ok($$('.qcm input:disabled').length === boxes.length);
  });
  await axe('QCM');

  await test('changement de langue : kréyòl, avertissement [auto]', async function () {
    change('#langsel', 'ht');
    assert.strictEqual(d.documentElement.lang, 'ht');
    assert.strictEqual($('h1').textContent, 'Diksyonè vizyèl mwen : kay la');
    assert.ok(/\[auto\]/.test($('.autonotice').textContent));
    change('#actsel', 'discover');
    assert.ok($$('.plate .label text').some(function (t) { return t.textContent === 'do kay la'; }));
    change('#langsel', 'es');
    assert.ok($$('.plate .label text').some(function (t) { return t.textContent === 'el tejado'; }));
    change('#langsel', 'fr');
    assert.ok(!$('.autonotice'));
  });

  await test('vue guidée : objet suivant', async function () {
    click($('#nextobj'));
    assert.strictEqual($('#objtitle').textContent, 'la porte');
    assert.strictEqual($('#objsel').value, 'porte');
  });

  await test('vue libre : galerie de 6 objets', async function () {
    change('#viewsel', 'free');
    assert.strictEqual($$('.gallery .card').length, 6);
    click($('#card-lit'));
    assert.strictEqual($('#objtitle').textContent, 'le lit');
    click($('#back'));
    assert.ok($('.gallery'));
  });
  await axe('galerie');

  await test('carte mentale : branches colorées, feuilles verrouillées puis dépliées, panneau Fermer', async function () {
    change('#viewsel', 'map');
    await wait(30);
    assert.strictEqual($$('.mapnode.branch').length, 6);
    click($('[data-node="lampe"]')); await wait(30);
    var leaves = $$('.mapnode.leaf');
    assert.strictEqual(leaves.length, 6);
    assert.ok(leaves.every(function (l) { return l.textContent === '?'; }), 'objet jamais ouvert : mots cachés');
    var panel = $('.mappanel');
    assert.ok(!panel.hidden);
    click(panel.querySelector('button'));
    assert.ok(panel.hidden);
    click($('[data-node="lampe"]')); await wait(30); // replier
    click($('[data-node="maison"]')); await wait(30);
    assert.ok($$('.mapnode.leaf').some(function (l) { return l.textContent === 'le toit'; }));
    var leaf = $('[data-node="maison.toit"]');
    assert.notStrictEqual(leaf.style.background, $('[data-node="maison"]').style.background);
    click(leaf);
    assert.ok(/protège de la pluie/.test($('.mappanel').textContent));
    var before = leaf.style.left;
    leaf.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert.notStrictEqual(leaf.style.left, before, 'déplacement au clavier');
    var ev = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    $('#mapframe').dispatchEvent(ev);
    assert.ok(ev.defaultPrevented, 'menu contextuel bloqué');
  });
  await axe('carte mentale');

  await test('réglages : taille, police dyslexie, contraste, sans animation', async function () {
    change('#sizesel', 'xlarge');
    assert.strictEqual(d.documentElement.getAttribute('data-size'), 'xlarge');
    ['dys', 'hc', 'noanim'].forEach(function (id) { var b = $('#' + id); b.checked = true; b.dispatchEvent(new w.Event('change', { bubbles: true })); assert.ok(d.documentElement.classList.contains(id)); });
  });

  await test('aucune erreur JavaScript pendant les tests', async function () { assert.deepStrictEqual(errors, []); });
  console.log('ui : ' + passed + ' tests réussis');
  w.close();
})().catch(function (e) { console.error(e); process.exit(1); });
