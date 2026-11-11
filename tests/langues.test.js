const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../src/i18n/i18n.js');
const dir = path.join(__dirname, '..', 'src', 'i18n');
const load = (l) => JSON.parse(fs.readFileSync(path.join(dir, l + '.json'), 'utf8'));

test('les quatre langues ont exactement les mêmes clés', () => {
  const ref = Object.keys(load('fr')).sort();
  for (const l of I18N.LANGS) assert.deepStrictEqual(Object.keys(load(l)).sort(), ref, l);
});
test('aucune traduction vide', () => {
  for (const l of I18N.LANGS) for (const [k, v] of Object.entries(load(l))) assert.ok(v.trim(), l + ':' + k);
});
test('repli sur le français puis sur la clé', () => {
  const d = { fr: { a: 'A' }, en: {} };
  assert.strictEqual(I18N.t(d, 'en', 'a'), 'A');
  assert.strictEqual(I18N.t(d, 'en', 'zz'), 'zz');
});
