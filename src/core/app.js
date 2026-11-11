// Interface : onglets, langue, thème, cours, voix. Navigateur seulement.
(function () {
  'use strict';
  var DATA = window.DJOUBA_DATA;
  var KEY = 'djouba.state.v1';
  var ex = { key: '', aides: 0, revealed: false, choice: '', need: false };
  var state = { lang: 'fr', theme: 'nuit', tab: 'cours', level: '', course: '', chapter: '0', gloss: '', srckind: 'bib', srctype: '', srcvar: '', src: '', speed: '1', voice: '' };

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

  function currentSources() {
    var c = state.course ? DATA.courses.contents[state.course] : null;
    return c ? COURSES.sources(c) : [];
  }

  function renderSources() {
    var all = currentSources();
    var ofKind = COURSES.filterSources(all, { kind: state.srckind }).map(function (x) { return x.s; });
    var types = COURSES.typesOf(ofKind), vars = COURSES.varietiesOf(ofKind);
    if (types.indexOf(state.srctype) < 0) state.srctype = '';
    if (vars.indexOf(state.srcvar) < 0) state.srcvar = '';
    fill($('sel-src-kind'), ['bib', 'web'].map(function (k) { return { value: k, label: t('src.kind.' + k) }; }), state.srckind);
    fill($('sel-src-type'), [{ value: '', label: t('src.type.all') }].concat(types.map(function (x) { return { value: x, label: t('src.type.' + x) }; })), state.srctype);
    fill($('sel-src-var'), [{ value: '', label: t('src.var.all') }].concat(vars.map(function (x) { return { value: x, label: x }; })), state.srcvar);
    var found = COURSES.filterSources(all, { kind: state.srckind, type: state.srctype, variety: state.srcvar });
    var chosen = null;
    found.forEach(function (x) { if (String(x.i) === state.src) chosen = x.s; });
    if (!chosen) state.src = '';
    fill($('sel-src-item'), [{ value: '', label: t('course.choose') }].concat(found.map(function (x) {
      return { value: String(x.i), label: x.s.title + (x.s.year ? ' (' + x.s.year + ')' : '') };
    })), state.src);
    ['sel-src-kind', 'sel-src-type', 'sel-src-var', 'sel-src-item'].forEach(function (id) { $(id).disabled = !all.length; });
    $('src-count').textContent = all.length ? t('src.found') + ' ' + found.length : '';
    $('btn-open').disabled = !chosen || !chosen.url;
    $('src-net').textContent = all.length ? t('src.net') : '';
    if (!state.course) { $('src-detail').textContent = t('src.nocourse'); return; }
    if (!all.length) { $('src-detail').textContent = t('src.none'); return; }
    if (!chosen) { $('src-detail').textContent = t('src.empty'); return; }
    var lines = [chosen.title, [chosen.by, chosen.year, t('src.type.' + chosen.type)].filter(Boolean).join(' · ')];
    if (chosen.varieties && chosen.varieties.length) lines.push(t('src.varieties') + ' ' + chosen.varieties.join(', '));
    lines.push(I18N.localized(chosen.note, state.lang));
    lines.push(chosen.url ? t('src.address') + ' ' + COURSES.address(chosen) : t('src.nolink'));
    $('src-detail').textContent = lines.join('\n\n');
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

  function currentExercise() {
    var ch = currentChapters()[parseInt(state.chapter, 10)];
    return ch && ch.exercise ? ch.exercise : null;
  }

  function renderExercise() {
    var chapters = currentChapters();
    fill($('sel-ex-chapter'), chapters.length ? chapters.map(function (c, i) {
      return { value: String(i), label: (i + 1) + '. ' + I18N.localized(c.title, state.lang) };
    }) : [{ value: '0', label: t('course.choose') }], state.chapter);
    var key = state.course + ':' + state.chapter;
    if (ex.key !== key) ex = { key: key, aides: 0, revealed: false, choice: '', need: false };
    var q = $('ex-question'), fb = $('ex-feedback'), e = currentExercise();
    var off = !state.course || !e;
    $('sel-ex-answer').disabled = off || ex.revealed;
    $('btn-restart').disabled = off;
    if (off) {
      q.textContent = !state.course ? t('ex.nocourse') : t('ex.noex');
      fill($('sel-ex-answer'), [{ value: '', label: t('course.choose') }], '');
      fb.textContent = '';
      $('btn-aide1').disabled = $('btn-aide2').disabled = $('btn-reponse').disabled = true;
      return;
    }
    q.textContent = I18N.localized(e.q, state.lang);
    fill($('sel-ex-answer'), [{ value: '', label: t('course.choose') }].concat(e.options.map(function (o, i) {
      return { value: String(i), label: I18N.localized(o, state.lang) };
    })), ex.choice);
    // Deux aides, dans l'ordre, avant la réponse.
    $('btn-aide1').disabled = ex.aides >= 1 || ex.revealed;
    $('btn-aide2').disabled = ex.aides !== 1 || ex.revealed;
    $('btn-reponse').disabled = ex.aides < 2 || ex.revealed;
    var lines = [];
    for (var i = 0; i < ex.aides; i++) lines.push(t('ex.aide' + (i + 1)) + ' : ' + I18N.localized(e.aides[i], state.lang));
    if (ex.need) lines.push(t('ex.need'));
    if (ex.revealed) {
      lines.push(String(e.answer) === ex.choice ? t('ex.good') : t('ex.bad'));
      lines.push(t('ex.correct') + ' ' + I18N.localized(e.options[e.answer], state.lang));
    }
    fb.textContent = lines.join('\n\n');
  }

  function renderGlossary() {
    var c = state.course ? DATA.courses.contents[state.course] : null;
    var list = c && c.glossary ? c.glossary : [];
    var chosen = list[parseInt(state.gloss, 10)];
    if (!chosen) state.gloss = '';
    var items = list.map(function (g, i) { return { value: String(i), label: I18N.localized(g.term, state.lang) }; });
    items.sort(function (a, b) { return a.label.localeCompare(b.label, state.lang === 'kr' ? 'fr' : state.lang); });
    fill($('sel-gloss'), [{ value: '', label: t('course.choose') }].concat(items), state.gloss);
    $('sel-gloss').disabled = !list.length;
    $('gloss-def').textContent = !c ? t('ex.nocourse') : !list.length ? t('gloss.none') : !chosen ? t('gloss.empty')
      : I18N.localized(chosen.term, state.lang) + '\n\n' + I18N.localized(chosen.def, state.lang);
  }

  function render() { renderStatic(); renderTabs(); renderCourses(); renderExercise(); renderGlossary(); renderSources(); renderVoices(); save(); }

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
    // Première ouverture : la page s'ouvre directement sur le premier cours.
    if (!state.level && !state.course && DATA.courses.index.courses.length) {
      var first = DATA.courses.index.courses[0];
      state.level = first.level; state.course = first.id; state.chapter = '0';
    }
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      onButton(b, function () { state.tab = b.getAttribute('data-tab'); render(); });
    });
    onChange($('sel-lang'), function (e) { state.lang = e.target.value; state.voice = ''; render(); });
    onChange($('sel-theme'), function (e) { state.theme = e.target.value; render(); });
    onChange($('sel-level'), function (e) { state.level = e.target.value; state.course = ''; state.chapter = '0'; state.gloss = ''; state.src = ''; render(); });
    onChange($('sel-course'), function (e) { state.course = e.target.value; state.chapter = '0'; state.gloss = ''; state.src = ''; render(); });
    onChange($('sel-src-kind'), function (e) { state.srckind = e.target.value; state.srctype = ''; state.srcvar = ''; state.src = ''; render(); });
    onChange($('sel-src-type'), function (e) { state.srctype = e.target.value; state.src = ''; render(); });
    onChange($('sel-src-var'), function (e) { state.srcvar = e.target.value; state.src = ''; render(); });
    onChange($('sel-src-item'), function (e) { state.src = e.target.value; render(); });
    onButton($('btn-open'), function () {
      var s = currentSources()[parseInt(state.src, 10)];
      if (s && s.url) window.open(COURSES.address(s), '_blank', 'noopener');
    });
    onChange($('sel-gloss'), function (e) { state.gloss = e.target.value; render(); });
    onChange($('sel-ex-chapter'), function (e) { state.chapter = e.target.value; render(); });
    onChange($('sel-ex-answer'), function (e) { ex.choice = e.target.value; ex.need = false; renderExercise(); });
    onButton($('btn-aide1'), function () { ex.aides = Math.max(ex.aides, 1); renderExercise(); });
    onButton($('btn-aide2'), function () { if (ex.aides === 1) ex.aides = 2; renderExercise(); });
    onButton($('btn-reponse'), function () {
      if (ex.aides < 2) return;
      if (ex.choice === '') { ex.need = true; renderExercise(); return; }
      ex.need = false; ex.revealed = true; renderExercise();
    });
    onButton($('btn-restart'), function () { ex = { key: ex.key, aides: 0, revealed: false, choice: '', need: false }; renderExercise(); });
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
