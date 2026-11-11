// Voix : synthèse du navigateur. Le kréyòl n'a pas de voix système, on prend une voix française.
var VOICE = (function () {
  var TAG = { fr: 'fr', kr: 'fr', en: 'en', es: 'es' };
  function pick(voices, lang) {
    var tag = TAG[lang] || 'fr';
    var list = (voices || []).filter(function (v) {
      return v.lang && v.lang.toLowerCase().indexOf(tag) === 0;
    });
    if (!list.length) return null;
    list.sort(function (a, b) { return (b.localService ? 1 : 0) - (a.localService ? 1 : 0); });
    return { voice: list[0], approximate: lang === 'kr', list: list };
  }
  function supported(root) { return !!(root && root.speechSynthesis && root.SpeechSynthesisUtterance); }
  function speak(root, text, voice, rate) {
    var u = new root.SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = rate || 1;
    root.speechSynthesis.cancel();
    root.speechSynthesis.speak(u);
  }
  return { pick: pick, supported: supported, speak: speak };
})();
if (typeof module !== 'undefined') module.exports = VOICE;
