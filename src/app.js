/* Interface : vues guidée / libre / carte mentale, planches fléchées,
 * activités avec 2 aides avant la solution, profils, réglages, sauvegardes. */
(function () {
  var C = CONTENT, K = CORE, M = MINDMAP;
  var NS = 'http://www.w3.org/2000/svg';
  var S = K.defaultState();
  var store = K.memoryStore();
  var ui = { obj: C.objects[0].id, act: 'discover', freeOpen: false, selected: null, mapExpanded: null, mapPos: {}, mapInfo: null, mapFocus: null, notice: '' };
  var session = null;
  var svgCount = 0;
  var root, live;

  /* ---------- Outils ---------- */
  function t(key, vars) { return K.fmt(K.tr(C.ui[key], S.lang), vars); }
  function n(entry) { return K.tr(entry, S.lang); }
  function obj(id) { return C.objects.filter(function (o) { return o.id === id; })[0]; }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'style') Object.keys(v).forEach(function (s) { if (s.slice(0, 2) === '--') e.style.setProperty(s, v[s]); else e.style[s] = v[s]; });
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function sv(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function select(id, label, options, value, onchange) {
    var s = el('select', { id: id, onchange: function (e) { onchange(e.target.value); } },
      options.map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === value }); }));
    return el('div', { class: 'field' }, [el('label', { for: id, text: label }), s]);
  }
  function append(parent, child) { if (child) parent.appendChild(child); }
  function save() { return store.set('state', S).catch(function () { /* stockage indisponible */ }); }
  function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
  function prog(objId) { return K.objProgress(S, S.current, objId); }
  function actLabel(a) { return t({ discover: 'actDiscover', show: 'actShow', arrow: 'actArrow', check: 'actCheck' }[a]); }
  function speak(text) {
    var lang = C.langs.filter(function (l) { return l.id === S.lang; })[0];
    var synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    var voices = synth ? synth.getVoices() : [];
    var prefix = lang.speech.split('-')[0];
    var voice = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(prefix) === 0; })[0];
    if (!synth || !voice) { say(t('noVoice')); ui.notice = t('noVoice'); render(); return; }
    var u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 0.85;
    synth.cancel(); synth.speak(u);
  }

  /* ---------- Dessin d'un objet ---------- */
  function labelSize(text) { return Math.max(11, Math.min(17, Math.floor(17 * 13 / Math.max(13, text.length)))); }
  function drawObject(o, opt) {
    svgCount += 1;
    var W = C.viewBox[0], H = C.viewBox[1], mk = 'fl' + svgCount;
    var svg = sv('svg', {
      viewBox: opt.mini ? '130 20 200 310' : '0 0 ' + W + ' ' + H,
      class: 'plate' + (opt.mini ? ' mini' : ''),
      role: opt.interactive ? 'group' : 'img',
      'aria-label': n(o.name)
    });
    svg.appendChild(sv('defs', {}, [sv('marker', { id: mk, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      [sv('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrowhead' })])]));
    o.parts.forEach(function (p, i) {
      var g = sv('g', { class: 'part' + (opt.highlight === p.id ? ' hl' : ''), 'data-part': p.id });
      p.shapes.forEach(function (s) {
        var a = { fill: p.fill || 'none', stroke: p.stroke || '#3E2723', 'stroke-width': p.sw || 1.5, 'stroke-linejoin': 'round' };
        var node;
        if (s.t === 'rect') { node = sv('rect', Object.assign(a, { x: s.x, y: s.y, width: s.w, height: s.h, rx: s.rx || 0 })); }
        else if (s.t === 'circle') { node = sv('circle', Object.assign(a, { cx: s.cx, cy: s.cy, r: s.r })); }
        else if (s.t === 'ellipse') { node = sv('ellipse', Object.assign(a, { cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry })); }
        else if (s.t === 'poly') { node = sv('polygon', Object.assign(a, { points: s.pts.join(' ') })); }
        else { node = sv('polyline', Object.assign(a, { points: s.pts.join(' '), fill: 'none', 'stroke-linecap': 'round' })); }
        g.appendChild(node);
      });
      if (opt.onPart) {
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', opt.partNames ? n(p.name) : t('partLabel', { n: i + 1 }));
        g.addEventListener('click', function () { opt.onPart(p.id); });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.onPart(p.id); }
        });
      }
      svg.appendChild(g);
    });
    if (opt.mini) return svg;
    var layout = K.layoutLabels(o, C.viewBox);
    layout.forEach(function (lab) {
      var p = K.findPart(o, lab.id);
      var show = opt.labels === 'all' || (opt.labels === 'some' && opt.labelParts.indexOf(lab.id) !== -1);
      if (!show) return;
      var text = opt.mystery === lab.id ? '?' : n(p.name);
      var x1 = lab.side === 'left' ? lab.lx + 4 : lab.lx - 4;
      var g = sv('g', { class: 'label' + (opt.highlight === lab.id ? ' hl' : '') + (opt.mystery === lab.id ? ' mystery' : ''), 'data-part': lab.id });
      g.appendChild(sv('line', { x1: x1, y1: lab.ly - 5, x2: lab.ax, y2: lab.ay, class: 'leader', 'marker-end': 'url(#' + mk + ')' }));
      g.appendChild(sv('circle', { cx: lab.ax, cy: lab.ay, r: 2.5, class: 'dot' }));
      g.appendChild(sv('text', { x: lab.lx, y: lab.ly, 'text-anchor': lab.side === 'left' ? 'end' : 'start', 'font-size': opt.mystery === lab.id ? 22 : labelSize(text), text: text }));
      if (opt.onLabel) g.addEventListener('click', function () { opt.onLabel(lab.id); });
      svg.appendChild(g);
    });
    return svg;
  }

  /* ---------- Activités ---------- */
  function startSession(act) {
    ui.act = act;
    ui.notice = '';
    ui.selected = null;
    var o = obj(ui.obj), rand = K.rng(Date.now() & 0xFFFFFF);
    if (act === 'discover') {
      session = null;
      prog(o.id).seen = true;
      save();
      return;
    }
    session = { act: act, objId: o.id, idx: 0, firstTry: 0, att: K.createAttempt(), feedback: [], done: false, rand: rand };
    if (act === 'show') session.questions = K.buildShowQuestions(o, rand);
    if (act === 'arrow') session.questions = K.buildArrowQuestions(o, rand);
    if (act === 'check') { session.questions = [0]; session.check = K.buildCheckQuestion(C.objects, o.id, S.lang, rand); session.ticked = []; }
    session.answer = null;
  }
  function currentPartId() { return session.questions[session.idx]; }
  function feedbackFor(status, hints, solutionText) {
    if (status === 'correct') return [t('correct')];
    if (status === 'hint1') return [t('wrong1'), hints[0]];
    if (status === 'hint2') return [t('wrong2'), hints[1]];
    return [t('solutionIs'), solutionText];
  }
  function answer(ok) {
    var o = obj(session.objId);
    var res = K.submitAttempt(session.att, ok);
    var hints, sol;
    if (session.act === 'check') {
      var opts = session.check.options;
      var intr = opts.filter(function (x) { return !x.good && session.ticked.indexOf(x.key) !== -1; })[0] || opts.filter(function (x) { return !x.good; })[0];
      hints = [t('hintCount', { n: session.check.answer.length }), t('hintIntruder', { word: n(intr.name), object: n(obj(intr.from).name) })];
      sol = opts.filter(function (x) { return x.good; }).map(function (x) { return n(x.name); }).join(', ');
    } else {
      var p = K.findPart(o, currentPartId());
      if (session.act === 'show') {
        hints = [t('hintSide', { side: t('side' + K.sideOf(o, p.id).replace(/^./, function (c) { return c.toUpperCase(); })) }), t('hintDef', { def: n(p.def) })];
      } else {
        hints = [t('hintDef', { def: n(p.def) }), t('hintLetter', { letter: K.firstLetter(n(p.name), S.lang) })];
      }
      sol = n(p.name);
    }
    session.status = res.status;
    session.feedback = feedbackFor(res.status, hints, sol);
    if (res.status === 'correct' && res.att.firstTry) session.firstTry += 1;
    say(session.feedback.join(' '));
    render();
  }
  function nextQuestion() {
    session.idx += 1;
    session.att = K.createAttempt();
    session.feedback = [];
    session.status = null;
    session.answer = null;
    if (session.idx >= session.questions.length) {
      session.done = true;
      prog(session.objId)[session.act] = { done: true, score: session.firstTry, total: session.questions.length };
      save();
      say(t('activityDone', { score: session.firstTry, total: session.questions.length }));
    }
    render();
  }

  /* ---------- Rendu des activités ---------- */
  function renderDiscover(o) {
    var box = el('div', { class: 'activity' });
    box.appendChild(el('p', { class: 'hint', text: t('discoverHint') }));
    function pick(id) { ui.selected = id; ui.notice = ''; render(); var b = document.getElementById('pl-' + id); if (b) b.focus(); }
    box.appendChild(el('div', { class: 'platewrap' }, [drawObject(o, { labels: 'all', highlight: ui.selected, onLabel: pick })]));
    // un clic sur le dessin sélectionne aussi la partie (sans ajouter d'arrêts de tabulation)
    box.querySelectorAll('g.part').forEach(function (g) { g.addEventListener('click', function () { pick(g.getAttribute('data-part')); }); });
    var list = el('div', { class: 'partlist', role: 'group', 'aria-label': t('partsList') },
      o.parts.map(function (p) {
        return el('button', { type: 'button', id: 'pl-' + p.id, class: 'chip' + (ui.selected === p.id ? ' on' : ''), 'aria-pressed': ui.selected === p.id ? 'true' : 'false', text: n(p.name), onclick: function () { pick(p.id); } });
      }));
    box.appendChild(el('h3', { text: t('partsList') }));
    box.appendChild(list);
    if (ui.selected) {
      var p = K.findPart(o, ui.selected);
      box.appendChild(el('div', { class: 'defcard', style: { borderColor: o.color } }, [
        el('p', { class: 'defword', text: n(p.name) }),
        el('p', { text: n(p.def) }),
        S.lang !== 'fr' ? el('p', { class: 'muted', text: 'FR : ' + p.name.fr }) : null,
        el('button', { type: 'button', class: 'btn', text: '🔊 ' + t('listen'), onclick: function () { speak(n(p.name) + '. ' + n(p.def)); } }),
        ui.notice ? el('p', { class: 'muted', text: ui.notice }) : null
      ]));
    }
    return box;
  }

  function feedbackBox() {
    if (!session.feedback.length) return null;
    var cls = session.status === 'correct' ? 'ok' : session.status === 'solution' ? 'sol' : 'ko';
    return el('div', { class: 'feedback ' + cls }, session.feedback.map(function (line, i) { return el('p', { class: i === 0 ? 'strong' : '', text: line }); }));
  }
  function counter() {
    return el('p', { class: 'muted', text: t('question', { n: session.idx + 1, total: session.questions.length }) });
  }
  function finished() { return K.canShowSolution(session.att); }

  function renderShow(o) {
    var box = el('div', { class: 'activity' }), p = K.findPart(o, currentPartId());
    box.appendChild(counter());
    box.appendChild(el('p', { class: 'prompt' }, [t('showPrompt') + ' ', el('strong', { text: n(p.name) })]));
    var opt = finished()
      ? { labels: 'some', labelParts: [p.id], highlight: p.id }
      : { labels: 'none', onPart: function (id) { answer(K.validate.single(id, p.id)); } };
    box.appendChild(el('div', { class: 'platewrap' }, [drawObject(o, opt)]));
    append(box, feedbackBox());
    if (finished()) box.appendChild(el('button', { type: 'button', id: 'nextq', class: 'btn primary', text: t('nextQuestion'), onclick: nextQuestion }));
    return box;
  }

  function renderArrow(o) {
    var box = el('div', { class: 'activity' }), p = K.findPart(o, currentPartId());
    box.appendChild(counter());
    box.appendChild(el('p', { class: 'prompt', text: t('arrowPrompt') }));
    box.appendChild(el('div', { class: 'platewrap' }, [drawObject(o, { labels: 'some', labelParts: [p.id], mystery: finished() ? null : p.id, highlight: finished() ? p.id : null })]));
    if (!finished()) {
      var names = K.shuffle(o.parts, K.rng(o.parts.length * 7 + session.idx + 1));
      var sel = select('arrowsel', t('arrowPrompt'), [['', t('choose')]].concat(names.map(function (q) { return [q.id, n(q.name)]; })), session.answer || '', function (v) { session.answer = v; });
      sel.querySelector('label').className = 'sr-only';
      box.appendChild(el('div', { class: 'row' }, [sel, el('button', { type: 'button', id: 'validate', class: 'btn primary', text: t('validate'), onclick: function () {
        if (!session.answer) { session.feedback = [t('noSelection')]; session.status = 'info'; say(t('noSelection')); render(); return; }
        answer(K.validate.single(session.answer, p.id));
      } })]));
    }
    append(box, feedbackBox());
    if (finished()) box.appendChild(el('button', { type: 'button', id: 'nextq', class: 'btn primary', text: t('nextQuestion'), onclick: nextQuestion }));
    return box;
  }

  function renderCheck(o) {
    var box = el('div', { class: 'activity' }), q = session.check, end = finished();
    var fs = el('fieldset', { class: 'qcm' }, [el('legend', { text: t('checkPrompt') + ' ' + n(o.name) })]);
    q.options.forEach(function (opt, i) {
      var id = 'cb' + i, checked = session.ticked.indexOf(opt.key) !== -1;
      var mark = end ? (opt.good ? ' ✓' : (checked ? ' ✗' : '')) : '';
      var input = el('input', { type: 'checkbox', id: id, checked: checked, disabled: end, onchange: function (e) {
        if (e.target.checked) session.ticked.push(opt.key);
        else session.ticked = session.ticked.filter(function (k) { return k !== opt.key; });
      } });
      fs.appendChild(el('div', { class: 'cbrow' + (end ? (opt.good ? ' good' : checked ? ' bad' : '') : '') }, [input, el('label', { for: id, text: n(opt.name) + mark })]));
    });
    box.appendChild(fs);
    if (!end) box.appendChild(el('button', { type: 'button', id: 'validate', class: 'btn primary', text: t('validate'), onclick: function () {
      if (!session.ticked.length) { session.feedback = [t('noSelection')]; session.status = 'info'; say(t('noSelection')); render(); return; }
      answer(K.validate.multi(session.ticked, q.answer));
    } }));
    append(box, feedbackBox());
    if (end) box.appendChild(el('button', { type: 'button', id: 'nextq', class: 'btn primary', text: t('nextQuestion'), onclick: nextQuestion }));
    return box;
  }

  function renderDone(o) {
    var acts = C.activities, i = acts.indexOf(session.act);
    return el('div', { class: 'activity' }, [
      el('p', { class: 'feedback ok strong', text: t('activityDone', { score: session.firstTry, total: session.questions.length }) }),
      el('div', { class: 'misconception' }, [el('h3', { text: '⚠ ' + t('misconception') }), el('p', { text: n(o.misconception) })]),
      el('div', { class: 'row' }, [
        el('button', { type: 'button', class: 'btn', id: 'restart', text: t('restart'), onclick: function () { startSession(session.act); render(); } }),
        i < acts.length - 1 ? el('button', { type: 'button', class: 'btn primary', id: 'nextact', text: t('activityNext'), onclick: function () { startSession(acts[i + 1]); render(); } }) : null
      ])
    ]);
  }

  function renderStage() {
    var o = obj(ui.obj), fg = K.textOn(o.color);
    var stage = el('section', { class: 'stage', 'aria-labelledby': 'objtitle', style: { '--obj': o.color } });
    stage.appendChild(el('div', { class: 'objhead', style: { background: o.color, color: fg } }, [
      el('h2', { id: 'objtitle', text: n(o.name) }),
      el('p', { text: n(o.intro) })
    ]));
    stage.appendChild(el('p', { class: 'register' }, [
      el('strong', { text: t('register') + ' : ' }), t('registerObs') + '. ',
      el('strong', { text: t('limit') + ' : ' }), n(o.limit)
    ]));
    stage.appendChild(select('actsel', t('activity'), C.activities.map(function (a) { return [a, actLabel(a)]; }), ui.act, function (v) { startSession(v); render(); }));
    var body;
    if (ui.act === 'discover' || !session) body = renderDiscover(o);
    else if (session.done) body = renderDone(o);
    else if (session.act === 'show') body = renderShow(o);
    else if (session.act === 'arrow') body = renderArrow(o);
    else body = renderCheck(o);
    stage.appendChild(body);
    return stage;
  }

  function badges(objId) {
    var p = prog(objId);
    var parts = [p.seen ? t('seen') : null].concat(['show', 'arrow', 'check'].map(function (a) { return p[a] && p[a].done ? actLabel(a) + ' ' + p[a].score + '/' + p[a].total : null; }));
    return parts.filter(Boolean).join(' · ');
  }

  function renderGuided() {
    var i = C.objects.map(function (o) { return o.id; }).indexOf(ui.obj);
    var nav = el('div', { class: 'row nav' }, [
      el('button', { type: 'button', class: 'btn', id: 'prevobj', text: '← ' + t('prev'), disabled: i === 0, onclick: function () { goObj(C.objects[i - 1].id); } }),
      select('objsel', t('object'), C.objects.map(function (o, k) { return [o.id, (k + 1) + '. ' + n(o.name)]; }), ui.obj, goObj),
      el('button', { type: 'button', class: 'btn', id: 'nextobj', text: t('next') + ' →', disabled: i === C.objects.length - 1, onclick: function () { goObj(C.objects[i + 1].id); } })
    ]);
    return el('div', {}, [nav, renderStage()]);
  }
  function goObj(id) { ui.obj = id; startSession('discover'); render(); }

  function renderFree() {
    if (ui.freeOpen) {
      return el('div', {}, [el('button', { type: 'button', class: 'btn', id: 'back', text: '← ' + t('backGallery'), onclick: function () { ui.freeOpen = false; render(); } }), renderStage()]);
    }
    return el('ul', { class: 'gallery' }, C.objects.map(function (o) {
      return el('li', {}, [el('button', { type: 'button', class: 'card', id: 'card-' + o.id, style: { borderColor: o.color }, onclick: function () { ui.obj = o.id; ui.freeOpen = true; startSession('discover'); render(); } }, [
        drawObject(o, { mini: true }),
        el('span', { class: 'cardname', style: { background: o.color, color: K.textOn(o.color) }, text: n(o.name) }),
        el('span', { class: 'muted small', text: badges(o.id) })
      ])]);
    }));
  }

  function renderMap() {
    var frame = el('div', { class: 'mapframe', id: 'mapframe' });
    setTimeout(function () {
      M.render(frame, {
        center: { label: t('mapCenter'), info: t('mapHint') },
        hint: t('mapHint'),
        closeLabel: t('close'),
        positions: ui.mapPos,
        expanded: ui.mapExpanded,
        openInfo: ui.mapInfo,
        onOpen: function (info) { ui.mapInfo = info; },
        onToggle: function (id) {
          ui.mapExpanded = ui.mapExpanded === id ? null : id;
          ui.mapFocus = id;
          render();
        },
        branches: C.objects.map(function (o) {
          var unlocked = prog(o.id).seen;
          var leafColor = M.mix(o.color, 0.72);
          return {
            id: o.id, label: n(o.name), color: o.color, textColor: K.textOn(o.color),
            info: n(o.intro) + ' ' + t('mapBranchInfo', { n: o.parts.length }),
            leaves: o.parts.map(function (p) {
              return { id: p.id, label: unlocked ? n(p.name) : '?', title: unlocked ? n(p.name) : '?', color: leafColor, textColor: K.textOn(leafColor),
                info: unlocked ? n(p.def) : t('mapLocked'), locked: !unlocked };
            })
          };
        })
      });
      if (ui.mapFocus) {
        var b = frame.querySelector('[data-node="' + ui.mapFocus + '"]');
        ui.mapFocus = null;
        if (b) b.focus();
      }
    }, 0);
    return frame;
  }

  /* ---------- Réglages, profils, sauvegardes ---------- */
  function applySettings() {
    var h = document.documentElement;
    h.lang = S.lang;
    h.setAttribute('data-size', S.settings.size);
    h.classList.toggle('dys', S.settings.dyslexia);
    h.classList.toggle('hc', S.settings.contrast);
    h.classList.toggle('noanim', S.settings.noAnim);
    document.title = t('appTitle');
  }
  function toggle(id, key) {
    return el('div', { class: 'cbrow' }, [
      el('input', { type: 'checkbox', id: id, checked: S.settings[key], onchange: function (e) { S.settings[key] = e.target.checked; save(); render(); } }),
      el('label', { for: id, text: t(key === 'dyslexia' ? 'dyslexia' : key === 'contrast' ? 'contrast' : 'noAnim') })
    ]);
  }
  function download(name, data, type) {
    var blob = new Blob([data], { type: type });
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function exportZip() {
    var zip = K.makeZip([
      { name: 'sauvegarde.json', data: JSON.stringify(S, null, 2) },
      { name: 'LISEZMOI.txt', data: 'Sauvegarde du dictionnaire visuel (la maison). Pour la restaurer : bouton « Restaurer (ZIP) ».\r\n' }
    ]);
    download('dictionnaire-visuel-sauvegarde.zip', zip, 'application/zip');
  }
  function importZip(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var files = K.readZip(new Uint8Array(reader.result));
        var f = files.filter(function (x) { return x.name === 'sauvegarde.json'; })[0];
        var st = f && K.sanitizeState(JSON.parse(K.fromUtf8(f.data)));
        if (!st) throw new Error('invalide');
        S = st; save(); ui.notice = ''; render(); say(t('importOk'));
      } catch (e) { say(t('importFail')); alert(t('importFail')); }
    };
    reader.readAsArrayBuffer(file);
  }
  function exportCsv() {
    var rows = [['pseudo', 'objet', 'activite', 'vu', 'termine', 'score_premier_coup', 'total']];
    S.profiles.forEach(function (pr) {
      C.objects.forEach(function (o) {
        var p = (S.progress[pr.id] || {})[o.id] || {};
        ['show', 'arrow', 'check'].forEach(function (a) {
          var r = p[a] || {};
          rows.push([pr.pseudo || t('guest'), o.name.fr, a, p.seen ? 1 : 0, r.done ? 1 : 0, r.score === undefined ? '' : r.score, r.total === undefined ? '' : r.total]);
        });
      });
    });
    download('dictionnaire-visuel-classe.csv', K.toCsv(rows), 'text/csv;charset=utf-8');
  }
  function renderProgress() {
    var head = el('tr', {}, [el('th', { scope: 'col', text: t('object') })].concat(C.activities.map(function (a) { return el('th', { scope: 'col', text: actLabel(a) }); })));
    var rows = C.objects.map(function (o) {
      var p = prog(o.id);
      return el('tr', {}, [el('th', { scope: 'row', text: n(o.name) })].concat(C.activities.map(function (a) {
        if (a === 'discover') return el('td', { text: p.seen ? '✓ ' + t('seen') : '–' });
        return el('td', { text: p[a] && p[a].done ? '✓ ' + p[a].score + '/' + p[a].total : '–' });
      })));
    });
    return el('div', { class: 'tablewrap' }, [el('table', {}, [el('caption', { text: t('progress') }), el('thead', {}, [head]), el('tbody', {}, rows)])]);
  }

  function renderHeader() {
    var profOpts = S.profiles.map(function (p) { return [p.id, p.pseudo || t('guest')]; }).concat([['__new', t('newProfile')]]);
    var file = el('input', { type: 'file', id: 'importfile', accept: '.zip,application/zip', class: 'sr-only', onchange: function (e) { if (e.target.files[0]) importZip(e.target.files[0]); } });
    return el('header', {}, [
      el('h1', { text: t('appTitle') }),
      el('div', { class: 'controls' }, [
        select('langsel', t('language'), C.langs.map(function (l) { return [l.id, l.name + (l.auto ? ' [auto]' : '')]; }), S.lang, function (v) {
          S.lang = v; save();
          if (session && session.act === 'check' && !session.done) startSession('check');
          render();
        }),
        select('profsel', t('profile'), profOpts, S.current, function (v) {
          if (v === '__new') {
            var pseudo = (prompt(t('pseudoPrompt')) || '').trim().slice(0, 40);
            if (pseudo) { var id = 'p' + Date.now(); S.profiles.push({ id: id, pseudo: pseudo }); S.current = id; }
          } else S.current = v;
          save(); startSession('discover'); render();
        }),
        select('viewsel', t('view'), [['guided', t('viewGuided')], ['free', t('viewFree')], ['map', t('viewMap')]], S.view, function (v) { S.view = v; ui.freeOpen = false; save(); render(); })
      ]),
      el('details', { class: 'panel', id: 'settings', open: ui.settingsOpen }, [
        el('summary', { text: t('settings'), onclick: function () { ui.settingsOpen = !ui.settingsOpen; } }),
        select('sizesel', t('textSize'), [['normal', t('sizeNormal')], ['large', t('sizeLarge')], ['xlarge', t('sizeXLarge')]], S.settings.size, function (v) { S.settings.size = v; save(); render(); }),
        toggle('dys', 'dyslexia'), toggle('hc', 'contrast'), toggle('noanim', 'noAnim')
      ]),
      el('details', { class: 'panel', id: 'datapanel', open: ui.dataOpen }, [
        el('summary', { text: t('progress') + ' · ' + t('data'), onclick: function () { ui.dataOpen = !ui.dataOpen; } }),
        renderProgress(),
        el('div', { class: 'row' }, [
          el('button', { type: 'button', class: 'btn', id: 'expzip', text: t('exportZip'), onclick: exportZip }),
          el('label', { for: 'importfile', class: 'btn', id: 'impzip', tabindex: '0', role: 'button', onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, [t('importZip')]),
          file,
          el('button', { type: 'button', class: 'btn', id: 'expcsv', text: t('exportCsv'), onclick: exportCsv })
        ]),
        el('p', { class: 'warning', text: t('csvWarning') })
      ]),
      S.lang !== 'fr' ? el('p', { class: 'autonotice', text: t('autoNotice') }) : null
    ]);
  }

  function render() {
    var focusId = document.activeElement && document.activeElement.id;
    applySettings();
    root.textContent = '';
    root.appendChild(renderHeader());
    var main = el('main', { id: 'main' });
    if (S.view === 'map') { main.appendChild(el('h2', { class: 'sr-only', text: t('viewMap') })); main.appendChild(renderMap()); }
    else if (S.view === 'free') main.appendChild(renderFree());
    else main.appendChild(renderGuided());
    root.appendChild(main);
    root.appendChild(el('footer', { text: t('footer') + ' · v' + APP_CONFIG.version }));
    if (focusId) {
      var f = document.getElementById(focusId);
      if (f) f.focus();
      else if (session && session.feedback.length) { var nq = document.getElementById('nextq') || document.getElementById('validate'); if (nq) nq.focus(); }
    } else if (session && document.getElementById('nextq')) document.getElementById('nextq').focus();
  }

  function boot() {
    root = document.getElementById('app');
    live = document.getElementById('live');
    render();
    K.openStore('dictionnaire-visuel-maison').then(function (s) {
      store = s;
      return s.get('state');
    }).then(function (saved) {
      var st = K.sanitizeState(saved);
      if (st) S = st;
      startSession('discover');
      render();
    }).catch(function () { startSession('discover'); render(); });
  }

  window.APP = { boot: boot, state: function () { return S; }, ui: ui, startSession: function (a) { startSession(a); render(); }, session: function () { return session; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
