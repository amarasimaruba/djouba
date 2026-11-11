const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../tools/build.js');
const html = fs.readFileSync(build(), 'utf8');

test('le fichier produit ne contient aucune adresse externe', () => {
  assert.ok(!/https?:\/\//i.test(html));
  assert.ok(!/<script[^>]+src=/i.test(html));
  assert.ok(!/<link\b/i.test(html));
});
test('le script assemblé est valide', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.strictEqual(scripts.length, 2);
  for (const code of scripts) new Function(code);
});
test('les trois onglets et le menu de langue sont des éléments de formulaire', () => {
  for (const id of ['tab-cours', 'tab-voix', 'tab-reglages']) assert.match(html, new RegExp('<button[^>]+id="' + id + '"'));
  assert.match(html, /<select id="sel-lang"/);
});
test('aucun clic hors de boutons : un seul écouteur de clic, aucun onclick', () => {
  const dirs = ['core', 'i18n', 'voice', 'courses'].map((d) => path.join(__dirname, '..', 'src', d));
  let n = 0;
  for (const d of dirs) for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(d, f), 'utf8');
    n += (s.match(/addEventListener\('click'/g) || []).length;
    assert.ok(!/dblclick|onclick/i.test(s), f);
  }
  assert.ok(!/onclick/i.test(html));
  assert.strictEqual(n, 1);
});

test("la page prévient quand JavaScript est bloqué et s'ouvre sur le premier cours", () => {
  assert.match(html, /<noscript>[\s\S]*JavaScript/);
  const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'app.js'), 'utf8');
  assert.match(app, /Première ouverture/);
});
