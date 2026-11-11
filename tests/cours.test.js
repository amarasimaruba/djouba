const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const COURSES = require('../src/courses/courses.js');
const I18N = require('../src/i18n/i18n.js');
const dir = path.join(__dirname, '..', 'src', 'courses');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

test('chaque cours a un niveau connu et un fichier existant', () => {
  for (const c of index.courses) {
    assert.ok(index.levels.includes(c.level), c.id);
    assert.ok(fs.existsSync(path.join(dir, c.file)), c.file);
  }
});
const body = (c) => JSON.parse(fs.readFileSync(path.join(dir, c.file), 'utf8'));

test('chaque cours et chaque étape ont titre et texte dans les quatre langues', () => {
  for (const c of index.courses) {
    const b = body(c);
    for (const l of I18N.LANGS) assert.ok(b.title[l], c.id + ' titre ' + l);
    const list = COURSES.chapters(b);
    assert.ok(list.length > 0, c.id);
    list.forEach((ch, i) => {
      for (const l of I18N.LANGS) {
        assert.ok(ch.title[l] && ch.title[l].trim(), c.id + ' étape ' + (i + 1) + ' titre ' + l);
        assert.ok(ch.text[l] && ch.text[l].trim().length > 40, c.id + ' étape ' + (i + 1) + ' texte ' + l);
      }
    });
  }
});
test('un cours ancien à texte unique devient une seule étape', () => {
  const old = { title: { fr: 'A' }, text: { fr: 'B' } };
  assert.strictEqual(COURSES.chapters(old).length, 1);
  assert.strictEqual(COURSES.chapters(old)[0].text.fr, 'B');
});
test("règle d'écriture : aucun tiret long dans les cours", () => {
  for (const c of index.courses) assert.ok(!/[\u2014\u2013]/.test(fs.readFileSync(path.join(dir, c.file), 'utf8')), c.id);
});
test('le cours igname a onze étapes', () => {
  assert.strictEqual(COURSES.chapters(body(COURSES.find(index, 'igname'))).length, 11);
});
test('recherche par niveau et par identifiant', () => {
  assert.strictEqual(COURSES.forLevel(index, 'tous').length, 1);
  assert.strictEqual(COURSES.forLevel(index, 'lycee').length, 0);
  assert.strictEqual(COURSES.find(index, 'igname').file, 'igname.json');
  assert.strictEqual(COURSES.find(index, 'absent'), null);
});

test('chaque étape du cours igname a un exercice : 3 réponses, une bonne, exactement 2 aides, 4 langues', () => {
  const b = body(COURSES.find(index, 'igname'));
  COURSES.chapters(b).forEach((ch, i) => {
    const e = ch.exercise, n = 'étape ' + (i + 1);
    assert.ok(e, n);
    assert.strictEqual(e.options.length, 3, n);
    assert.ok(Number.isInteger(e.answer) && e.answer >= 0 && e.answer < 3, n);
    assert.strictEqual(e.aides.length, 2, n + ' : deux aides avant la réponse');
    for (const l of I18N.LANGS) {
      assert.ok(e.q[l] && e.q[l].trim(), n + ' question ' + l);
      e.options.forEach((o, k) => assert.ok(o[l] && o[l].trim(), n + ' option ' + k + ' ' + l));
      e.aides.forEach((a, k) => assert.ok(a[l] && a[l].trim(), n + ' aide ' + k + ' ' + l));
    }
  });
});

test('le glossaire du cours igname est complet en quatre langues et ses mots sont dans le cours', () => {
  const b = body(COURSES.find(index, 'igname'));
  assert.ok(b.glossary.length >= 30);
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const text = norm(JSON.stringify(b.chapters.map((c) => [c.title.fr, c.text.fr, c.exercise])));
  for (const g of b.glossary) {
    for (const l of I18N.LANGS) {
      assert.ok(g.term[l] && g.term[l].trim(), 'terme ' + l);
      assert.ok(g.def[l] && g.def[l].trim().length > 5, 'définition ' + g.term.fr + ' ' + l);
    }
    const stem = norm(g.term.fr).split(/[\s,]+/)[0].slice(0, 5);
    assert.ok(text.includes(stem), 'mot absent du cours : ' + g.term.fr);
  }
});
