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

  /* data : { center, tree[{id,label,color,textColor,info,title?,locked?,children?[…]}],
   *          path (ids dépliés, du niveau 1 vers le bas), positions, closeLabel, hint, openInfo,
   *          onOpen(info), onToggle(newPath, nodeId) } */
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
    var minWH = Math.min(w, h), path = data.path || [];
    center.x = w / 2; center.y = h / 2;
    var KINDS = ['branch', 'sub', 'leaf'];
    /* Arbre radial : chaque bulle visible sans enfants affichés reçoit la même part du cercle,
     * un parent se place au milieu de ses enfants, et chaque niveau sur une ellipse plus grande.
     * Un seul chemin est déplié à la fois (pièce → objet). */
    function grow(list, parent, depth) {
      list.forEach(function (c) {
        var nodePath = parent.path.concat(c.id);
        var open = !!c.children && path[depth] === c.id && parent.path.every(function (p, j) { return path[j] === p; });
        var nd = addNode({ id: nodePath.join('/'), kind: KINDS[Math.min(depth, 2)] + (c.locked ? ' locked' : ''), label: c.label, color: c.color, textColor: c.textColor,
          title: c.title || c.label, info: c.info, depth: depth, hasChildren: !!(c.children && c.children.length), expanded: c.children ? open : undefined });
        nd.path = nodePath; nd.depth = depth + 1; nd.kids = [];
        parent.kids.push(nd);
        links.push([parent, nd, depth < 2 ? c.color : parent.spec.color]);
        if (open) grow(c.children, nd, depth + 1);
      });
    }
    center.path = []; center.kids = []; center.depth = 0;
    grow(data.tree, center, 0);
    /* une bulle fermée (pièce ou objet) compte plus qu'une partie : l'éventail des parties reste groupé */
    function leaves(nd) { return nd.kids.length ? nd.kids.reduce(function (s, k) { return s + leaves(k); }, 0) : (nd.spec.hasChildren ? 2.5 : 1); }
    function maxDepth(nd) { return nd.kids.reduce(function (m, k) { return Math.max(m, maxDepth(k)); }, nd.depth); }
    var L = leaves(center), D = maxDepth(center);
    var rx = w / 2 - 62, ry = h / 2 - 28;
    function ring(d) { return D === 1 ? 0.62 : 0.34 + 0.66 * (d - 1) / (D - 1); }
    /* Répartition le long de l'ellipse à longueur d'arc égale (et non à angle égal) :
     * sur un cadre étroit, les bulles ne s'entassent pas en haut et en bas. */
    var STEPS = 360, cum = [0];
    for (var i = 1; i <= STEPS; i++) {
      var t0 = -Math.PI / 2 + 2 * Math.PI * (i - 1) / STEPS, t1 = -Math.PI / 2 + 2 * Math.PI * i / STEPS;
      cum.push(cum[i - 1] + Math.hypot(rx * (Math.cos(t1) - Math.cos(t0)), ry * (Math.sin(t1) - Math.sin(t0))));
    }
    function tAt(frac) {
      frac = ((frac % 1) + 1) % 1;
      var target = frac * cum[STEPS], j = 1;
      while (j < STEPS && cum[j] < target) j++;
      var part = (target - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
      return -Math.PI / 2 + 2 * Math.PI * (j - 1 + part) / STEPS;
    }
    function assign(nd, f0, f1) {
      var tot = leaves(nd), f = f0;
      nd.kids.forEach(function (k) {
        var span = (f1 - f0) * leaves(k) / tot;
        k.mid = f + span / 2;
        assign(k, f, f + span);
        f += span;
      });
    }
    var first = center.kids.length ? leaves(center.kids[0]) : 1;
    assign(center, -first / L / 2, 1 - first / L / 2);
    // cadre étroit : la pièce dépliée est tournée vers la droite, là où l'ellipse est la plus longue
    var offset = 0, PULL = 0.62;
    var openRoom = center.kids.filter(function (k) { return k.kids.length; })[0];
    if (openRoom && w < h) offset = 0.25 - openRoom.mid;
    // les bulles sans enfants affichés vont sur l'ellipse extérieure…
    (function place(nd) {
      nd.kids.forEach(function (k) {
        if (!k.kids.length) {
          var t = tAt(k.mid + offset), f = ring(D);
          k.x = w / 2 + Math.cos(t) * rx * f;
          k.y = h / 2 + Math.sin(t) * ry * f;
        }
        place(k);
      });
    })(center);
    // …et une bulle dépliée se place entre son parent et le centre de ses enfants (de bas en haut).
    (function pull(nd, parent) {
      nd.kids.forEach(function (k) { if (k.kids.length) pull(k, nd); });
      if (!parent || !nd.kids.length) return;
      var mx = 0, my = 0;
      nd.kids.forEach(function (k) { mx += k.x; my += k.y; });
      mx /= nd.kids.length; my /= nd.kids.length;
      var px = parent === center ? w / 2 : parent.x, py = parent === center ? h / 2 : parent.y;
      nd.x = px + (mx - px) * PULL; nd.y = py + (my - py) * PULL;
    })(center, null);

    nodes.forEach(function (nd) {
      nd.w = nd.el.offsetWidth || 90;
      nd.h = nd.el.offsetHeight || 44;
      // taille figée : une bulle placée près du bord droit ne doit pas se replier sur deux lignes
      if (nd.el.offsetWidth) { nd.el.style.width = Math.ceil(nd.w) + 'px'; nd.el.style.height = Math.ceil(nd.h) + 'px'; }
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
      if (nd.spec.hasChildren && data.onToggle) {
        var d = nd.spec.depth;
        var next = path[d] === nd.path[d] && nd.path.every(function (p, j) { return path[j] === p; }) ? nd.path.slice(0, d) : nd.path.slice();
        data.onToggle(next, nd.id);
      }
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
  function atWall(nd, w) { return nd.x <= nd.w / 2 + 5 || nd.x >= w - nd.w / 2 - 5; }
  function relax(nodes, w, h) {
    for (var it = 0; it < 300; it++) {
      var movedAny = false;
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var ox = (a.w + b.w) / 2 + 6 - Math.abs(a.x - b.x);
          var oy = (a.h + b.h) / 2 + 6 - Math.abs(a.y - b.y);
          if (ox > 0 && oy > 0) {
            movedAny = true;
            var horiz = ox / (a.w + b.w) < oy / (a.h + b.h);
            // contre un bord gauche ou droit, on écarte verticalement (sinon les bulles oscillent)
            if (horiz && (atWall(a, w) || atWall(b, w))) horiz = false;
            var sx = a.x <= b.x ? -1 : 1, sy = a.y <= b.y ? -1 : 1;
            var share = a.fixed ? 0 : (b.fixed ? 1 : 0.5);
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
