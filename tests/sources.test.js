const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const COURSES = require('../src/courses/courses.js');
const I18N = require('../src/i18n/i18n.js');
const dir = path.join(__dirname, '..', 'src', 'courses');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const igname = JSON.parse(fs.readFileSync(path.join(dir, 'igname.json'), 'utf8'));
const BIB = ['livre', 'article', 'rapport'], WEB = ['video', 'audio', 'image', 'site'];

test('le cours igname a une bibliographie et une webographie, avec vidéos et images', () => {
  const list = COURSES.sources(igname);
  assert.ok(list.length >= 25);
  assert.ok(COURSES.filterSources(list, { kind: 'bib' }).length >= 10);
  assert.ok(COURSES.filterSources(list, { kind: 'web' }).length >= 5);
  for (const type of ['livre', 'article', 'rapport', 'video', 'image', 'site']) assert.ok(COURSES.typesOf(list).includes(type), type);
});
test('chaque source a un type cohérent, un titre, un auteur et une note dans les quatre langues', () => {
  COURSES.sources(igname).forEach((s, i) => {
    const n = 'source ' + (i + 1) + ' : ' + s.title;
    assert.ok(s.kind === 'bib' ? BIB.includes(s.type) : s.kind === 'web' && WEB.includes(s.type), n);
    assert.ok(s.title && s.title.trim() && s.by && s.by.trim(), n);
    for (const l of I18N.LANGS) assert.ok(s.note[l] && s.note[l].trim().length > 10, n + ' note ' + l);
    if (s.kind === 'web') assert.ok(s.url, n + ' : une ressource web a une adresse');
    if (s.year) assert.ok(Number.isInteger(s.year) && s.year > 1900 && s.year < 2100, n);
    if (s.varieties) assert.ok(Array.isArray(s.varieties) && s.varieties.every((v) => v.trim()), n);
  });
});
test("les adresses sont rangées sans 'https://' et sans espace ; le préfixe est ajouté à l'ouverture", () => {
  for (const s of COURSES.sources(igname)) {
    if (!s.url) continue;
    assert.ok(!/^[a-z]+:\/\//i.test(s.url) && !/\s/.test(s.url), s.url);
    assert.ok(/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s.url), s.url);
    assert.strictEqual(COURSES.address(s), 'https://' + s.url);
  }
  assert.strictEqual(COURSES.address({ title: 'Livre' }), '');
});
test('aucune source en double (même titre ou même adresse)', () => {
  const list = COURSES.sources(igname);
  assert.strictEqual(new Set(list.map((s) => s.title)).size, list.length);
  const urls = list.filter((s) => s.url).map((s) => s.url);
  assert.strictEqual(new Set(urls).size, urls.length);
});
test('filtres par liste, type et variété', () => {
  const list = COURSES.sources(igname);
  const boutou = COURSES.filterSources(list, { variety: 'Boutou' });
  assert.ok(boutou.length >= 4 && boutou.every((x) => x.s.varieties.includes('Boutou')));
  assert.ok(COURSES.varietiesOf(list).includes('Belep'));
  assert.deepStrictEqual(COURSES.filterSources(list, { kind: 'web', type: 'livre' }), []);
  assert.deepStrictEqual(COURSES.sources({}), []);
});
test("règle d'écriture : aucun tiret long dans les sources", () => {
  assert.ok(!/[—–]/.test(JSON.stringify(igname.sources)));
});
test('les textes des onglets et des types de source existent dans les quatre langues', () => {
  const keys = ['tab.sources', 'src.kind.bib', 'src.kind.web', 'src.open', 'src.net', 'src.nolink'].concat(BIB.concat(WEB).map((x) => 'src.type.' + x));
  for (const l of I18N.LANGS) {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', l + '.json'), 'utf8'));
    for (const k of keys) assert.ok(d[k], l + ' ' + k);
  }
  assert.ok(index.courses.length >= 1);
});
