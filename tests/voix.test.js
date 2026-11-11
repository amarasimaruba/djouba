const test = require('node:test');
const assert = require('node:assert');
const VOICE = require('../src/voice/voice.js');
const voices = [
  { name: 'Fr réseau', lang: 'fr-FR', localService: false },
  { name: 'Fr local', lang: 'fr-FR', localService: true },
  { name: 'En local', lang: 'en-US', localService: true },
];
test('sans voix, pick renvoie null', () => assert.strictEqual(VOICE.pick([], 'fr'), null));
test('une voix locale passe avant une voix réseau', () => {
  assert.strictEqual(VOICE.pick(voices, 'fr').voice.name, 'Fr local');
});
test('le kréyòl prend une voix française et se déclare approximatif', () => {
  const r = VOICE.pick(voices, 'kr');
  assert.strictEqual(r.voice.lang, 'fr-FR');
  assert.strictEqual(r.approximate, true);
});
test("l'espagnol sans voix espagnole renvoie null", () => assert.strictEqual(VOICE.pick(voices, 'es'), null));
test('sans synthèse vocale, supported renvoie false', () => assert.strictEqual(VOICE.supported({}), false));
