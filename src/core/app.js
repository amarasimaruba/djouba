// Interface : onglets, langue, thème, cours, voix. Navigateur seulement.
(function () {
  'use strict';
  var DATA = window.DJOUBA_DATA;
  var KEY = 'djouba.state.v1';
  var state = { lang: 'fr', theme: 'nuit', tab: 'cours', level: '', course: '', chapter: '0', speed: '1', voice: '' };

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      Object.keys(s).forEach(function (k) { if (k in state) state[k] = s[k]; });
    } catch (e) { /* stockage indisponible */ }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ } }
  function $(id) { return document.getElementById(id); }
  function t(key) { return I18N.t(DATA.i18n, state.lang, key); }
  // Seul point d'entrée des clics : de vrais boutons.
  function onButton(btn, fn) { btn.addEventListener('click', fn); }
  function onChange(sel, fn) { sel.addEventListener('change', fn); }

  function fill(sel, items, current) {
    sel.innerHTML = '';
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.value; o.textContent = it.label;
      sel.appendChild(o);
    });
    sel.value = current;
  }

  function renderStatic() {
    document.documentElement.lang = state.lang === 'kr' ? 'fr' : state.lang;
    document.documentElement.setAttribute('data-theme', state.theme);
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    $('sel-lang').value = state.lang;
    $('sel-theme').value = state.theme;
    $('sel-speed').value = state.speed;
  }

  function renderTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      var on = b.getAttribute('data-tab') === state.tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      $('panel-' + b.getAttribute('data-tab')).hidden = !on;
    });
  }

  function currentChapters() {
    var c = state.course ? DATA.courses.contents[state.course] : null;
    return c ? COURSES.chapters(c) : [];
  }

  function currentText() {
    var list = currentChapters();
    var ch = list[parseInt(state.chapter, 10)];
    if (!ch) return '';
    return I18N.localized(ch.title, state.lang) + '\n\n' + I18N.localized(ch.text, state.lang);
  }

  function renderCourses() {
    var idx = DATA.courses.index;
    fill($('sel-level'), [{ value: '', label: t('course.choose') }].concat(
      COURSES.levels(idx).map(function (l) { return { value: l, label: t('level.' + l) }; })), state.level);
    var list = state.level ? COURSES.forLevel(idx, state.level) : [];
    if (!list.some(function (c) { return c.id === state.course; })) state.course = '';
    fill($('sel-course'), [{ value: '', label: t('course.choose') }].concat(list.map(function (c) {
      return { value: c.id, label: I18N.localized(DATA.courses.contents[c.id].title, state.lang) };
    })), state.course);
    var chapters = currentChapters();
    if (parseInt(state.chapter, 10) >= chapters.length) state.chapter = '0';
    fill($('sel-chapter'), chapters.length ? chapters.map(function (ch, i) {
      return { value: String(i), label: (i + 1) + '. ' + I18N.localized(ch.title, state.lang) };
    }) : [{ value: '0', label: t('course.choose') }], state.chapter);
    $('btn-prev').disabled = !chapters.length || state.chapter === '0';
    $('btn-next').disabled = !chapters.length || parseInt(state.chapter, 10) >= chapters.length - 1;
    $('course-text').textContent = currentText() || t('course.empty');
  }

  function renderVoices() {
    var note = $('voice-note');
    if (!VOICE.supported(window)) {
      fill($('sel-voice'), [{ value: '', label: t('voice.auto') }], '');
      note.textContent = t('voice.unsupported');
      return;
    }
    var found = VOICE.pick(window.speechSynthesis.getVoices(), state.lang);
    var items = [{ value: '', label: t('voice.auto') }];
    if (found) found.list.forEach(function (v) { items.push({ value: v.name, label: v.name }); });
    fill($('sel-voice'), items, state.voice);
    note.textContent = !found ? t('voice.none') : (found.approximate ? t('voice.approx') : '');
  }

  function render() { renderStatic(); renderTabs(); renderCourses(); renderVoices(); save(); }

  function chosenVoice() {
    var found = VOICE.pick(window.speechSynthesis.getVoices(), state.lang);
    if (!found) return null;
    if (state.voice) {
      for (var i = 0; i < found.list.length; i++) if (found.list[i].name === state.voice) return found.list[i];
    }
    return found.voice;
  }

  function init() {
    load();
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      onButton(b, function () { state.tab = b.getAttribute('data-tab'); render(); });
    });
    onChange($('sel-lang'), function (e) { state.lang = e.target.value; state.voice = ''; render(); });
    onChange($('sel-theme'), function (e) { state.theme = e.target.value; render(); });
    onChange($('sel-level'), function (e) { state.level = e.target.value; state.course = ''; state.chapter = '0'; render(); });
    onChange($('sel-course'), function (e) { state.course = e.target.value; state.chapter = '0'; render(); });
    onChange($('sel-chapter'), function (e) { state.chapter = e.target.value; render(); });
    onButton($('btn-prev'), function () { state.chapter = String(Math.max(0, parseInt(state.chapter, 10) - 1)); render(); });
    onButton($('btn-next'), function () { state.chapter = String(parseInt(state.chapter, 10) + 1); render(); });
    onChange($('sel-speed'), function (e) { state.speed = e.target.value; save(); });
    onChange($('sel-voice'), function (e) { state.voice = e.target.value; save(); });
    onButton($('btn-read'), function () {
      var text = currentText();
      if (!VOICE.supported(window)) { $('voice-note').textContent = t('voice.unsupported'); return; }
      if (!text) { $('voice-note').textContent = t('voice.nocourse'); return; }
      VOICE.speak(window, text, chosenVoice(), parseFloat(state.speed));
    });
    onButton($('btn-pause'), function () { if (VOICE.supported(window)) window.speechSynthesis.pause(); });
    onButton($('btn-resume'), function () { if (VOICE.supported(window)) window.speechSynthesis.resume(); });
    onButton($('btn-stop'), function () { if (VOICE.supported(window)) window.speechSynthesis.cancel(); });
    if (VOICE.supported(window)) window.speechSynthesis.onvoiceschanged = renderVoices;
    render();
  }
  init();
})();
