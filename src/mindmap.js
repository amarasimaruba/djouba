/* Carte mentale interactive : bulles déplaçables (souris, tactile, clavier),
 * une couleur par branche, sous-branches d'une teinte différente,
 * panneau d'explication DANS le cadre avec bouton Fermer. */
var MINDMAP = (function () {
  var STEP = 12;

  function mix(hex, amount) {
    var h = hex.replace('#', '');
    var c = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
    var m = c.map(function (v) { return Math.round(v + (255 - v) * amount); });
    return '#' + m.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase();
  }

  /* data : { center, branches[{id,label,color,textColor,info,leaves[{id,label,color,textColor,title,info,locked}]}],
   *          expanded, positions, closeLabel, hint, openInfo, onOpen(info), onToggle(id) } */
  function render(frame, data) {
    frame.textContent = '';
    var w = frame.clientWidth || 640;
    /* La bande du bas est réservée au panneau d'explication : il ne cache jamais une bulle placée automatiquement. */
    var reserve = w < 520 ? 170 : 130;
    var h = (frame.clientHeight || 560) - reserve;
    var pos = data.positions;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'maplines');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.height = h + 'px';
    frame.appendChild(svg);

    var hint = document.createElement('p');
    hint.className = 'maphint';
    hint.textContent = data.hint;
    frame.appendChild(hint);

    var panel = document.createElement('div');
    panel.className = 'mappanel';
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-live', 'polite');
    var ptitle = document.createElement('h3');
    var ptext = document.createElement('p');
    var pclose = document.createElement('button');
    pclose.type = 'button';
    pclose.className = 'btn';
    pclose.textContent = data.closeLabel;
    pclose.addEventListener('click', function () { panel.hidden = true; hint.hidden = false; if (data.onOpen) data.onOpen(null); });
    panel.appendChild(ptitle); panel.appendChild(ptext); panel.appendChild(pclose);
    panel.setAttribute('aria-label', data.closeLabel);

    var nodes = [], links = [];
    function addNode(spec) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mapnode ' + spec.kind;
      b.textContent = spec.label;
      b.style.background = spec.color;
      b.style.color = spec.textColor;
      b.setAttribute('data-node', spec.id);
      if (spec.expanded !== undefined) b.setAttribute('aria-expanded', spec.expanded ? 'true' : 'false');
      frame.appendChild(b);
      var node = { id: spec.id, el: b, x: 0, y: 0, fixed: !!pos[spec.id], spec: spec };
      nodes.push(node);
      return node;
    }

    var center = addNode({ id: 'center', kind: 'center', label: data.center.label, color: '#1A1A1A', textColor: '#FFFFFF', title: data.center.label, info: data.center.info });
    var n = data.branches.length, minWH = Math.min(w, h);
    center.x = w / 2; center.y = h / 2;
    data.branches.forEach(function (br, i) {
      var ang = -Math.PI / 2 + i * 2 * Math.PI / n;
      var bn = addNode({ id: br.id, kind: 'branch', label: br.label, color: br.color, textColor: br.textColor, title: br.label, info: br.info, branch: br.id, expanded: data.expanded === br.id });
      bn.x = w / 2 + Math.cos(ang) * w * 0.33;
      bn.y = h / 2 + Math.sin(ang) * h * 0.33;
      links.push([center, bn, br.color]);
      if (data.expanded === br.id) {
        var k = br.leaves.length, spread = Math.PI * 1.3;
        br.leaves.forEach(function (lf, j) {
          var a = ang - spread / 2 + (k === 1 ? spread / 2 : j * spread / (k - 1));
          var ln = addNode({ id: br.id + '.' + lf.id, kind: 'leaf' + (lf.locked ? ' locked' : ''), label: lf.label, color: lf.color, textColor: lf.textColor, title: lf.title, info: lf.info });
          ln.x = bn.x + Math.cos(a) * minWH * 0.24;
          ln.y = bn.y + Math.sin(a) * minWH * 0.24;
          links.push([bn, ln, br.color]);
        });
      }
    });

    nodes.forEach(function (nd) {
      nd.w = nd.el.offsetWidth || 90;
      nd.h = nd.el.offsetHeight || 44;
      if (pos[nd.id]) { nd.x = pos[nd.id][0] * w; nd.y = pos[nd.id][1] * h; }
    });
    relax(nodes, w, h);
    nodes.forEach(place);
    frame.appendChild(panel);
    if (data.openInfo) { ptitle.textContent = data.openInfo.title; ptext.textContent = data.openInfo.info; panel.hidden = false; hint.hidden = true; }
    drawLinks();

    function clamp(nd) {
      nd.x = Math.max(nd.w / 2 + 4, Math.min(w - nd.w / 2 - 4, nd.x));
      nd.y = Math.max(nd.h / 2 + 4, Math.min(h - nd.h / 2 - 4, nd.y));
    }
    function place(nd) {
      clamp(nd);
      nd.el.style.left = Math.round(nd.x - nd.w / 2) + 'px';
      nd.el.style.top = Math.round(nd.y - nd.h / 2) + 'px';
    }
    function drawLinks() {
      svg.textContent = '';
      links.forEach(function (l) {
        var line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', l[0].x); line.setAttribute('y1', l[0].y);
        line.setAttribute('x2', l[1].x); line.setAttribute('y2', l[1].y);
        line.setAttribute('stroke', l[2]);
        line.setAttribute('stroke-width', l[0] === center ? 5 : 3);
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      });
    }
    function remember(nd) { pos[nd.id] = [nd.x / w, nd.y / h]; }
    function open(nd) {
      var info = { title: nd.spec.title, info: nd.spec.info };
      ptitle.textContent = info.title;
      ptext.textContent = info.info;
      panel.hidden = false;
      hint.hidden = true;
      if (data.onOpen) data.onOpen(info);
      if (nd.spec.branch && data.onToggle) data.onToggle(nd.spec.branch);
    }

    nodes.forEach(function (nd) {
      var start = null, moved = false;
      nd.el.addEventListener('pointerdown', function (e) {
        start = { x: e.clientX, y: e.clientY, nx: nd.x, ny: nd.y };
        moved = false;
        try { nd.el.setPointerCapture(e.pointerId); } catch (err) { /* ancien navigateur */ }
      });
      nd.el.addEventListener('pointermove', function (e) {
        if (!start) return;
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        moved = true;
        nd.x = start.nx + dx; nd.y = start.ny + dy;
        place(nd); drawLinks();
      });
      function end() { if (start && moved) remember(nd); start = null; }
      nd.el.addEventListener('pointerup', end);
      nd.el.addEventListener('pointercancel', end);
      nd.el.addEventListener('click', function (e) {
        if (moved) { moved = false; e.preventDefault(); return; }
        open(nd);
      });
      nd.el.addEventListener('keydown', function (e) {
        var d = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[e.key];
        if (!d) return;
        e.preventDefault();
        nd.x += d[0]; nd.y += d[1];
        place(nd); remember(nd); drawLinks();
      });
    });

    /* Bloquer sélection, glisser natif et menu contextuel dans la carte. */
    ['contextmenu', 'dragstart', 'selectstart'].forEach(function (ev) {
      frame.addEventListener(ev, function (e) { e.preventDefault(); });
    });
    return { nodes: nodes, panel: panel };
  }

  /* Écarte les bulles qui se chevauchent (les bulles déjà placées par l'élève ne bougent pas). */
  function relax(nodes, w, h) {
    for (var it = 0; it < 60; it++) {
      var movedAny = false;
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var ox = (a.w + b.w) / 2 + 6 - Math.abs(a.x - b.x);
          var oy = (a.h + b.h) / 2 + 6 - Math.abs(a.y - b.y);
          if (ox > 0 && oy > 0) {
            movedAny = true;
            var horiz = ox / (a.w + b.w) < oy / (a.h + b.h);
            var sx = a.x <= b.x ? -1 : 1, sy = a.y <= b.y ? -1 : 1;
            var share = a.fixed || a.id === 'center' ? 0 : (b.fixed || b.id === 'center' ? 1 : 0.5);
            if (horiz) { a.x += sx * ox * share; b.x -= sx * ox * (1 - share); }
            else { a.y += sy * oy * share; b.y -= sy * oy * (1 - share); }
          }
        }
      }
      nodes.forEach(function (nd) {
        nd.x = Math.max(nd.w / 2 + 4, Math.min(w - nd.w / 2 - 4, nd.x));
        nd.y = Math.max(nd.h / 2 + 4, Math.min(h - nd.h / 2 - 4, nd.y));
      });
      if (!movedAny) break;
    }
  }

  return { render: render, mix: mix };
})();
if (typeof module !== 'undefined') module.exports = MINDMAP;
