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
test('chaque cours a titre et texte dans les quatre langues', () => {
  for (const c of index.courses) {
    const body = JSON.parse(fs.readFileSync(path.join(dir, c.file), 'utf8'));
    for (const l of I18N.LANGS) {
      assert.ok(body.title[l], c.id + ' titre ' + l);
      assert.ok(body.text[l], c.id + ' texte ' + l);
    }
  }
});
test('recherche par niveau et par identifiant', () => {
  assert.strictEqual(COURSES.forLevel(index, 'primaire').length, 1);
  assert.strictEqual(COURSES.forLevel(index, 'lycee').length, 0);
  assert.strictEqual(COURSES.find(index, 'essai').file, 'essai.json');
  assert.strictEqual(COURSES.find(index, 'absent'), null);
});
