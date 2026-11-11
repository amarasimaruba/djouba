const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const I18N = require('../src/i18n/i18n.js');
const { create } = require('../tools/nouveau-cours.js');
const root = path.join(__dirname, '..');
const tpl = JSON.parse(fs.readFileSync(path.join(root, 'modeles', 'cours-vide.json'), 'utf8'));
const four = (o) => I18N.LANGS.every((l) => l in o);

test('le modèle vide suit le format des cours', () => {
  assert.ok(four(tpl.title));
  const ch = tpl.chapters[0], e = ch.exercise;
  assert.ok(four(ch.title) && four(ch.text) && four(e.q));
  assert.strictEqual(e.options.length, 3);
  e.options.forEach((o) => assert.ok(four(o)));
  assert.strictEqual(e.aides.length, 2);
  e.aides.forEach((a) => assert.ok(four(a)));
  assert.ok(Number.isInteger(e.answer));
});
test('le modèle est vide : toutes les cases de texte sont vides', () => {
  const leaves = [];
  (function walk(v) {
    if (typeof v === 'string') leaves.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })([tpl.title, tpl.chapters]);
  assert.ok(leaves.length > 0);
  assert.ok(leaves.every((x) => x === ''));
});
test('nouveau-cours copie le modèle et inscrit le cours dans un dossier de test', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'djouba-'));
  fs.mkdirSync(path.join(tmp, 'src', 'courses'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'modeles'));
  fs.copyFileSync(path.join(root, 'src', 'courses', 'index.json'), path.join(tmp, 'src', 'courses', 'index.json'));
  fs.copyFileSync(path.join(root, 'modeles', 'cours-vide.json'), path.join(tmp, 'modeles', 'cours-vide.json'));
  const dest = create(tmp, 'essai-vide', 'tous');
  assert.ok(fs.existsSync(dest));
  const idx = JSON.parse(fs.readFileSync(path.join(tmp, 'src', 'courses', 'index.json'), 'utf8'));
  assert.ok(idx.courses.some((c) => c.id === 'essai-vide'));
  assert.ok(!('_notes' in JSON.parse(fs.readFileSync(dest, 'utf8'))));
  assert.throws(() => create(tmp, 'essai-vide', 'tous'), /existe déjà/);
  assert.throws(() => create(tmp, 'Mauvais Nom', 'tous'), /Identifiant/);
  assert.throws(() => create(tmp, 'autre', 'université'), /Niveau inconnu/);
});
