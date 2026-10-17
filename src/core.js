/* Noyau : textes, géométrie des dessins, moteur d'essais, linter,
 * stockage (IndexedDB avec repli mémoire), ZIP et CSV.
 * Aucune dépendance, aucun accès réseau. */
var CORE = (function () {
  var MAX_TRIES = 3;
  var LANG_IDS = ['fr', 'ht', 'en', 'es'];

  /* ---------- Textes ---------- */
  function tr(entry, lang) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    return entry[lang] !== undefined && entry[lang] !== '' ? entry[lang] : (entry.fr || '');
  }
  function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] !== undefined ? String(vars[k]) : m;
    });
  }
  /* Première lettre du mot principal, sans l'article (« la poignée » → p). */
  function firstLetter(name, lang) {
    var s = String(name).trim();
    var lead = { fr: /^(le |la |les |l['’])/i, es: /^(el |la |los |las )/i, en: /^(the )/i };
    if (lead[lang]) s = s.replace(lead[lang], '');
    return s.charAt(0).toLocaleUpperCase();
  }

  /* ---------- Hasard reproductible ---------- */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function shuffle(list, rand) {
    var a = list.slice();
    rand = rand || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Géométrie ---------- */
  function bbox(sh) {
    if (sh.t === 'rect') return [sh.x, sh.y, sh.x + sh.w, sh.y + sh.h];
    if (sh.t === 'circle') return [sh.cx - sh.r, sh.cy - sh.r, sh.cx + sh.r, sh.cy + sh.r];
    if (sh.t === 'ellipse') return [sh.cx - sh.rx, sh.cy - sh.ry, sh.cx + sh.rx, sh.cy + sh.ry];
    var xs = sh.pts.map(function (p) { return p[0]; });
    var ys = sh.pts.map(function (p) { return p[1]; });
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  }
  function inPolygon(pts, x, y) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function distToSegment(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2)) : 0;
    var px = a[0] + t * dx, py = a[1] + t * dy;
    return Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
  }
  function shapeContains(sh, x, y, sw) {
    if (sh.t === 'rect') return x >= sh.x && x <= sh.x + sh.w && y >= sh.y && y <= sh.y + sh.h;
    if (sh.t === 'circle') return (x - sh.cx) * (x - sh.cx) + (y - sh.cy) * (y - sh.cy) <= sh.r * sh.r;
    if (sh.t === 'ellipse') {
      var ex = (x - sh.cx) / sh.rx, ey = (y - sh.cy) / sh.ry;
      return ex * ex + ey * ey <= 1;
    }
    if (sh.t === 'poly') return inPolygon(sh.pts, x, y);
    if (sh.t === 'line') {
      for (var i = 1; i < sh.pts.length; i++) {
        if (distToSegment(x, y, sh.pts[i - 1], sh.pts[i]) <= (sw || 4) / 2 + 1) return true;
      }
      return false;
    }
    return false;
  }
  /* Partie visible (la plus haute dans l'ordre de dessin) au point (x, y). */
  function partAt(obj, x, y) {
    for (var i = obj.parts.length - 1; i >= 0; i--) {
      var p = obj.parts[i];
      for (var k = 0; k < p.shapes.length; k++) {
        if (shapeContains(p.shapes[k], x, y, p.sw)) return p.id;
      }
    }
    return null;
  }
  /* Position grossière d'un point dans le dessin, pour l'aide 1. */
  function sideOf(obj, partId) {
    var part = findPart(obj, partId);
    var all = [Infinity, Infinity, -Infinity, -Infinity];
    obj.parts.forEach(function (p) {
      p.shapes.forEach(function (s) {
        var b = bbox(s);
        all = [Math.min(all[0], b[0]), Math.min(all[1], b[1]), Math.max(all[2], b[2]), Math.max(all[3], b[3])];
      });
    });
    var rx = (part.a[0] - all[0]) / (all[2] - all[0]);
    var ry = (part.a[1] - all[1]) / (all[3] - all[1]);
    var dx = Math.abs(rx - 0.5), dy = Math.abs(ry - 0.5);
    if (dx < 0.17 && dy < 0.17) return 'middle';
    if (dy >= dx) return ry < 0.5 ? 'top' : 'bottom';
    return rx < 0.5 ? 'left' : 'right';
  }
  function findPart(obj, partId) {
    for (var i = 0; i < obj.parts.length; i++) if (obj.parts[i].id === partId) return obj.parts[i];
    return null;
  }

  /* Place les étiquettes à gauche et à droite du dessin, sans chevauchement. */
  function layoutLabels(obj, viewBox) {
    var W = viewBox[0], H = viewBox[1], mid = W / 2, gap = 30, top = 22, bottom = H - 12;
    var sorted = obj.parts.slice().sort(function (a, b) { return a.a[1] - b.a[1] || a.a[0] - b.a[0]; });
    var sides = { left: [], right: [] };
    sorted.forEach(function (p) {
      var side;
      if (p.a[0] < mid - 2) side = 'left';
      else if (p.a[0] > mid + 2) side = 'right';
      else side = sides.left.length <= sides.right.length ? 'left' : 'right';
      sides[side].push(p);
    });
    var out = [];
    ['left', 'right'].forEach(function (side) {
      var list = sides[side], ys = [];
      list.forEach(function (p, i) {
        var y = Math.max(p.a[1], top);
        if (i > 0) y = Math.max(y, ys[i - 1] + gap);
        ys.push(y);
      });
      var overflow = ys.length ? ys[ys.length - 1] - bottom : 0;
      if (overflow > 0) {
        for (var i = ys.length - 1; i >= 0; i--) {
          ys[i] -= overflow;
          if (i > 0 && ys[i - 1] > ys[i] - gap) overflow = ys[i - 1] - (ys[i] - gap); else break;
        }
      }
      list.forEach(function (p, i) {
        out.push({
          id: p.id, side: side,
          lx: side === 'left' ? 124 : W - 124,
          ly: ys[i],
          ax: p.a[0], ay: p.a[1]
        });
      });
    });
    return out;
  }

  /* ---------- Validateurs ---------- */
  var validate = {
    single: function (given, expected) { return given !== null && given !== undefined && given !== '' && given === expected; },
    multi: function (given, expected) {
      if (!given || given.length !== expected.length) return false;
      var e = expected.slice().sort(), g = given.slice().sort();
      for (var i = 0; i < e.length; i++) if (e[i] !== g[i]) return false;
      return true;
    },
    point: function (obj, x, y, expectedPart) { return partAt(obj, x, y) === expectedPart; }
  };

  /* ---------- Moteur d'essais : 2 aides avant la solution ---------- */
  function createAttempt() {
    return { fails: 0, solved: false, revealed: false, firstTry: false };
  }
  function submitAttempt(att, ok) {
    if (att.solved || att.revealed) return { status: att.solved ? 'correct' : 'solution', att: att };
    if (ok) {
      att.solved = true;
      att.firstTry = att.fails === 0;
      return { status: 'correct', att: att };
    }
    att.fails += 1;
    if (att.fails >= MAX_TRIES) { att.revealed = true; return { status: 'solution', att: att }; }
    return { status: att.fails === 1 ? 'hint1' : 'hint2', att: att };
  }
  function canShowSolution(att) { return att.solved || att.revealed; }

  /* ---------- Questions ---------- */
  function buildShowQuestions(obj, rand) {
    return shuffle(obj.parts.map(function (p) { return p.id; }), rand);
  }
  function buildArrowQuestions(obj, rand) {
    return shuffle(obj.parts.map(function (p) { return p.id; }), rand);
  }
  /* QCM : 4 bonnes parties maximum + 3 intrus pris dans les AUTRES pièces.
   * On écarte tout intrus dont le nom existe déjà dans la même pièce (objet ou partie) :
   * par exemple « le robinet » ne peut pas être un intrus pour l'évier de la cuisine. */
  function roomNames(objects, room, lang) {
    var names = {};
    objects.forEach(function (o) {
      if (o.room !== room) return;
      names[tr(o.name, lang)] = true;
      o.parts.forEach(function (p) { names[tr(p.name, lang)] = true; });
    });
    return names;
  }
  function buildCheckQuestion(objects, objId, lang, rand) {
    var obj = objects.filter(function (o) { return o.id === objId; })[0];
    var good = shuffle(obj.parts, rand).slice(0, Math.min(4, obj.parts.length));
    var banned = roomNames(objects, obj.room, lang);
    obj.parts.forEach(function (p) { banned[tr(p.name, lang)] = true; });
    banned[tr(obj.name, lang)] = true;
    var pool = [];
    objects.forEach(function (o) {
      if (o.id === objId || (obj.room !== undefined && o.room === obj.room)) return;
      o.parts.forEach(function (p) {
        if (!banned[tr(p.name, lang)]) pool.push({ obj: o, part: p });
      });
    });
    var seen = {};
    var intruders = shuffle(pool, rand).filter(function (it) {
      var n = tr(it.part.name, lang);
      if (seen[n]) return false;
      seen[n] = true; return true;
    }).slice(0, 3);
    var options = good.map(function (p) { return { key: objId + '.' + p.id, name: p.name, good: true }; })
      .concat(intruders.map(function (it) { return { key: it.obj.id + '.' + it.part.id, name: it.part.name, good: false, from: it.obj.id }; }));
    return { options: shuffle(options, rand), answer: good.map(function (p) { return objId + '.' + p.id; }) };
  }

  /* ---------- Contraste ---------- */
  function lum(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var rgb = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  function contrastRatio(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function textOn(bg) {
    return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#FFFFFF') ? '#000000' : '#FFFFFF';
  }

  /* ---------- Linter (bloquant au build) ---------- */
  function lint(content) {
    var errors = [];
    function need4(entry, where) {
      LANG_IDS.forEach(function (l) {
        if (!entry || typeof entry[l] !== 'string' || (entry[l].trim() === '' && !(where === 'ui.autoNotice' && l === 'fr'))) {
          errors.push('Traduction manquante [' + l + '] : ' + where);
        }
      });
    }
    Object.keys(content.ui).forEach(function (k) { need4(content.ui[k], 'ui.' + k); });
    Object.keys(content.ui).forEach(function (k) {
      var ph = (content.ui[k].fr.match(/\{\w+\}/g) || []).sort().join();
      LANG_IDS.forEach(function (l) {
        if ((String(content.ui[k][l]).match(/\{\w+\}/g) || []).sort().join() !== ph) errors.push('Variables différentes [' + l + '] : ui.' + k);
      });
    });
    var objIds = {};
    var W = content.viewBox[0], H = content.viewBox[1];
    var roomIds = {};
    (content.rooms || []).forEach(function (r) {
      if (roomIds[r.id]) errors.push('Identifiant de pièce en double : ' + r.id);
      roomIds[r.id] = true;
      need4(r.name, 'rooms.' + r.id + '.name');
      if (contrastRatio(r.color, textOn(r.color)) < 4.5 || contrastRatio(r.color, '#FFFFFF') < 3) errors.push('Contraste insuffisant pour la pièce ' + r.id);
      if (!content.objects.some(function (o) { return o.room === r.id; })) errors.push('Pièce sans objet : ' + r.id);
    });
    content.objects.forEach(function (o) {
      if (objIds[o.id]) errors.push('Identifiant d\'objet en double : ' + o.id);
      objIds[o.id] = true;
      if (content.objects.some(function (q) { return q !== o && q.color.toUpperCase() === o.color.toUpperCase(); })) errors.push('Deux objets ont la même couleur : ' + o.id);
      if (content.rooms && !roomIds[o.room]) errors.push('Pièce inconnue pour ' + o.id + ' : ' + o.room);
      (o.deco || []).forEach(function (d) {
        if (!d.fill) errors.push('Décor sans couleur : ' + o.id);
        d.shapes.forEach(function (sh) {
          var b = bbox(sh);
          if (b[0] < 130 || b[2] > W - 130 || b[1] < 0 || b[3] > H) errors.push('Décor hors de la zone centrale : ' + o.id);
        });
      });
      ['name', 'intro', 'limit', 'misconception'].forEach(function (f) { need4(o[f], o.id + '.' + f); });
      if (!/^Croire que /.test(o.misconception.fr)) errors.push('Idée reçue non cadrée par « Croire que… » : ' + o.id);
      if (contrastRatio(o.color, textOn(o.color)) < 4.5) errors.push('Contraste < 4,5:1 pour la couleur de ' + o.id);
      if (contrastRatio(o.color, '#FFFFFF') < 3) errors.push('Contraste < 3:1 entre la couleur de ' + o.id + ' et le fond (bordures)');
      if (o.parts.length < 4 || o.parts.length > 8) errors.push('Nombre de parties hors de 4 à 8 : ' + o.id);
      var partIds = {}, frNames = {};
      o.parts.forEach(function (p) {
        var where = o.id + '.' + p.id;
        if (partIds[p.id]) errors.push('Identifiant de partie en double : ' + where);
        partIds[p.id] = true;
        need4(p.name, where + '.name');
        need4(p.def, where + '.def');
        if (!/^(le |la |les |l['’])/.test(p.name.fr)) errors.push('Nom sans article (le, la, l\', les) : ' + where);
        if (frNames[p.name.fr]) errors.push('Deux parties portent le même nom : ' + where);
        frNames[p.name.fr] = true;
        LANG_IDS.forEach(function (l) {
          if (p.def[l] && p.name[l] && p.def[l].toLowerCase().indexOf(p.name[l].replace(/^(le |la |les |l['’]|el |los |las |the )/i, '').toLowerCase()) !== -1) {
            errors.push('La définition contient le mot à trouver [' + l + '] : ' + where);
          }
        });
        if (!p.fill && !p.stroke) errors.push('Partie sans couleur : ' + where);
        if (!p.shapes || !p.shapes.length) errors.push('Partie sans dessin : ' + where);
        p.shapes.forEach(function (s) {
          var b = bbox(s);
          if (b[0] < 130 || b[2] > W - 130 || b[1] < 0 || b[3] > H) errors.push('Dessin hors de la zone centrale : ' + where);
        });
        if (!p.a || p.a.length !== 2) { errors.push('Point de flèche manquant : ' + where); return; }
        var hit = partAt(o, p.a[0], p.a[1]);
        if (hit !== p.id) errors.push('La flèche de ' + where + ' pointe sur ' + (hit || 'le vide') + ' (partie cachée ou mal placée)');
      });
      layoutLabels(o, content.viewBox).forEach(function (lab) {
        if (lab.ly < 10 || lab.ly > H - 4) errors.push('Étiquette hors cadre : ' + o.id + '.' + lab.id);
      });
    });
    return errors;
  }

  /* ---------- Stockage ---------- */
  function memoryStore() {
    var mem = {};
    return {
      kind: 'memory',
      get: function (k) { return Promise.resolve(mem[k] === undefined ? null : JSON.parse(mem[k])); },
      set: function (k, v) { mem[k] = JSON.stringify(v); return Promise.resolve(); }
    };
  }
  function openStore(dbName) {
    return new Promise(function (resolve) {
      var idb;
      try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null; } catch (e) { idb = null; }
      if (!idb) { resolve(memoryStore()); return; }
      var req;
      try { req = idb.open(dbName, 1); } catch (e) { resolve(memoryStore()); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onerror = function () { resolve(memoryStore()); };
      req.onblocked = function () { resolve(memoryStore()); };
      req.onsuccess = function () {
        var db = req.result;
        function tx(mode, fn) {
          return new Promise(function (res, rej) {
            try {
              var t = db.transaction('kv', mode);
              var r = fn(t.objectStore('kv'));
              t.oncomplete = function () { res(r && r.result !== undefined ? r.result : null); };
              t.onerror = function () { rej(t.error); };
            } catch (e) { rej(e); }
          });
        }
        resolve({
          kind: 'indexeddb',
          get: function (k) { return tx('readonly', function (s) { return s.get(k); }).then(function (v) { return v === undefined ? null : v; }); },
          set: function (k, v) { return tx('readwrite', function (s) { s.put(JSON.parse(JSON.stringify(v)), k); }); }
        });
      };
    });
  }

  /* ---------- ZIP (sans compression) ---------- */
  var CRC_TABLE = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function fromUtf8(u8) { return new TextDecoder().decode(u8); }
  function makeZip(files) {
    var chunks = [], central = [], offset = 0;
    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    files.forEach(function (f) {
      var name = utf8(f.name), data = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(data);
      var common = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      var local = new Uint8Array([].concat(u32(0x04034b50), common));
      chunks.push(local, name, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), common, u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += local.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var all = chunks.concat(central, [end]);
    var total = all.reduce(function (s, c) { return s + c.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }
  function readZip(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), files = [], pos = 0;
    while (pos + 30 <= u8.length && dv.getUint32(pos, true) === 0x04034b50) {
      var method = dv.getUint16(pos + 8, true);
      var crc = dv.getUint32(pos + 14, true);
      var size = dv.getUint32(pos + 18, true);
      var nlen = dv.getUint16(pos + 26, true), xlen = dv.getUint16(pos + 28, true);
      if (method !== 0) throw new Error('compression non prise en charge');
      var name = fromUtf8(u8.subarray(pos + 30, pos + 30 + nlen));
      var start = pos + 30 + nlen + xlen;
      if (start + size > u8.length) throw new Error('archive tronquée');
      var data = u8.slice(start, start + size);
      if (crc32(data) !== crc) throw new Error('archive abîmée (CRC)');
      files.push({ name: name, data: data });
      pos = start + size;
    }
    if (!files.length) throw new Error('archive vide ou invalide');
    return files;
  }

  /* ---------- CSV ---------- */
  function csvCell(v) {
    var s = String(v === undefined || v === null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = '\'' + s; // évite l'injection de formules dans un tableur
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
  }

  /* ---------- État de l'élève ---------- */
  function defaultState() {
    return {
      version: 1,
      lang: 'fr',
      view: 'guided',
      current: 'p1',
      profiles: [{ id: 'p1', pseudo: '' }],
      progress: {},
      settings: { size: 'normal', dyslexia: false, contrast: false, noAnim: false }
    };
  }
  function sanitizeState(s) {
    var d = defaultState();
    if (!s || typeof s !== 'object' || s.version !== 1 || !Array.isArray(s.profiles) || !s.profiles.length) return null;
    var out = d;
    if (LANG_IDS.indexOf(s.lang) !== -1) out.lang = s.lang;
    if (['guided', 'free', 'map'].indexOf(s.view) !== -1) out.view = s.view;
    out.profiles = s.profiles.filter(function (p) { return p && typeof p.id === 'string'; }).map(function (p) {
      return { id: p.id.slice(0, 40), pseudo: String(p.pseudo || '').slice(0, 40) };
    });
    if (!out.profiles.length) return null;
    out.current = out.profiles.some(function (p) { return p.id === s.current; }) ? s.current : out.profiles[0].id;
    out.progress = s.progress && typeof s.progress === 'object' ? JSON.parse(JSON.stringify(s.progress)) : {};
    if (s.settings && typeof s.settings === 'object') {
      out.settings.size = ['normal', 'large', 'xlarge'].indexOf(s.settings.size) !== -1 ? s.settings.size : 'normal';
      ['dyslexia', 'contrast', 'noAnim'].forEach(function (k) { out.settings[k] = !!s.settings[k]; });
    }
    return out;
  }
  function objProgress(state, profileId, objId) {
    var p = state.progress[profileId] || (state.progress[profileId] = {});
    return p[objId] || (p[objId] = { seen: false, show: null, arrow: null, check: null });
  }

  return {
    MAX_TRIES: MAX_TRIES, LANG_IDS: LANG_IDS,
    tr: tr, fmt: fmt, firstLetter: firstLetter, rng: rng, shuffle: shuffle,
    bbox: bbox, shapeContains: shapeContains, partAt: partAt, sideOf: sideOf, findPart: findPart, layoutLabels: layoutLabels,
    validate: validate, createAttempt: createAttempt, submitAttempt: submitAttempt, canShowSolution: canShowSolution,
    roomNames: roomNames, buildShowQuestions: buildShowQuestions, buildArrowQuestions: buildArrowQuestions, buildCheckQuestion: buildCheckQuestion,
    contrastRatio: contrastRatio, textOn: textOn, lint: lint,
    openStore: openStore, memoryStore: memoryStore,
    crc32: crc32, makeZip: makeZip, readZip: readZip, utf8: utf8, fromUtf8: fromUtf8,
    toCsv: toCsv, defaultState: defaultState, sanitizeState: sanitizeState, objProgress: objProgress
  };
})();
if (typeof module !== 'undefined') module.exports = CORE;
