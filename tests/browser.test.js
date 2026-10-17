/* Tests dans un vrai navigateur (Chromium via Playwright) : captures, chevauchements
 * d'étiquettes, débordement horizontal à 390 px, carte mentale, axe-core avec contraste. */
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var chromium = require('playwright').chromium;
var url = 'file://' + path.join(__dirname, '..', 'dist', 'dictionnaire-visuel-maison.html');
var shots = path.join(__dirname, '..', 'rapport', 'captures');
var axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
var passed = 0;
function ok(name) { passed++; console.log('  ✓ ' + name); }

function overlaps(a, b) { return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }

async function labelCheck(page, where) {
  var boxes = await page.$$eval('.plate:not(.mini) .label text', function (ts) {
    return ts.map(function (t) { var r = t.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, t: t.textContent }; });
  });
  var svg = await page.$eval('.plate:not(.mini)', function (s) { var r = s.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    assert.ok(b.x >= svg.x - 1 && b.x + b.width <= svg.x + svg.width + 1, where + ' : étiquette coupée « ' + b.t + ' »');
    for (var j = i + 1; j < boxes.length; j++) assert.ok(!overlaps(b, boxes[j]), where + ' : « ' + b.t + ' » chevauche « ' + boxes[j].t + ' »');
  }
  // les étiquettes ne recouvrent pas le dessin
  var parts = await page.$$eval('.plate:not(.mini) g.part', function (gs) {
    return gs.map(function (g) { var r = g.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, id: g.getAttribute('data-part') }; });
  });
  boxes.forEach(function (b) { parts.forEach(function (p) { assert.ok(!overlaps(b, p), where + ' : « ' + b.t + ' » recouvre le dessin (' + p.id + ')'); }); });
  return boxes.length;
}
async function noHScroll(page, where) {
  var d = await page.evaluate(function () { return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
  assert.ok(d.sw <= d.cw, where + ' : débordement horizontal ' + d.sw + ' > ' + d.cw);
}
async function axe(page, where) {
  await page.evaluate(axeSrc);
  var v = await page.evaluate(async function () {
    var r = await window.axe.run(document);
    return r.violations.map(function (x) { return x.id + ': ' + x.nodes.slice(0, 3).map(function (n) { return n.target.join(' '); }).join(' | '); });
  });
  assert.strictEqual(v.length, 0, 'axe ' + where + ' : ' + v.join('\n'));
}

(async function () {
  var browser = await chromium.launch();
  var errors = [];
  var configs = [{ name: 'ordinateur', vp: { width: 1100, height: 900 } }, { name: 'mobile', vp: { width: 390, height: 844 }, mobile: true }];
  for (var c = 0; c < configs.length; c++) {
    var cfg = configs[c];
    var ctx = await browser.newContext({ viewport: cfg.vp, isMobile: !!cfg.mobile, hasTouch: !!cfg.mobile, deviceScaleFactor: cfg.mobile ? 2 : 1 });
    var page = await ctx.newPage();
    var requests = [];
    page.on('pageerror', function (e) { errors.push(cfg.name + ' : ' + e.message); });
    page.on('request', function (r) { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
    await page.goto(url);
    await page.waitForSelector('#objtitle');
    var objs = await page.evaluate(function () { return CONTENT.objects.map(function (o) { return o.id; }); });
    for (var l = 0; l < 4; l++) {
      var lang = ['fr', 'ht', 'en', 'es'][l];
      await page.selectOption('#langsel', lang);
      for (var i = 0; i < objs.length; i++) {
        await page.selectOption('#objsel', objs[i]);
        var where = cfg.name + '/' + lang + '/' + objs[i];
        var n = await labelCheck(page, where);
        assert.ok(n >= 4);
        await noHScroll(page, where);
        if (lang === 'fr') await page.locator('.stage').screenshot({ path: path.join(shots, cfg.name + '-' + objs[i] + '.png') });
      }
    }
    ok(cfg.name + ' : ' + objs.length + ' objets × 4 langues, étiquettes sans chevauchement ni coupure, pas de débordement');
    await page.selectOption('#langsel', 'fr');
    await page.selectOption('#objsel', 'porte');
    await axe(page, cfg.name + ' découvrir');
    // cibles tactiles ≥ 44 px
    var small = await page.$$eval('button, select, .btn, summary', function (els) {
      return els.filter(function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map(function (e) { return e.id || e.textContent.slice(0, 20); });
    });
    assert.deepStrictEqual(small, [], 'cibles < 44 px : ' + small.join(', '));
    ok(cfg.name + ' : axe-core (contraste compris) sans violation, cibles ≥ 44 px');

    // Activité « Montre-moi » : un clic réel sur le dessin
    await page.selectOption('#actsel', 'show');
    var target = await page.evaluate(function () { var s = APP.session(); return s.questions[0]; });
    // clic au point visé par la flèche (converti en coordonnées écran)
    var pt = await page.evaluate(function (id) {
      var o = CONTENT.objects.filter(function (x) { return x.id === APP.session().objId; })[0];
      var p = CORE.findPart(o, id), svg = document.querySelector('.plate:not(.mini)');
      var q = svg.createSVGPoint(); q.x = p.a[0]; q.y = p.a[1];
      var r = q.matrixTransform(svg.getScreenCTM());
      return { x: r.x, y: r.y };
    }, target);
    await page.mouse.click(pt.x, pt.y);
    var fb = await page.textContent('.feedback');
    assert.ok(/Bravo/.test(fb), cfg.name + ' clic réel : ' + fb);
    await noHScroll(page, cfg.name + ' montre-moi');
    await axe(page, cfg.name + ' montre-moi');
    await page.selectOption('#actsel', 'arrow');
    await axe(page, cfg.name + ' flèche');
    await page.locator('.stage').screenshot({ path: path.join(shots, cfg.name + '-exercice-fleche.png') });
    await page.selectOption('#actsel', 'check');
    await noHScroll(page, cfg.name + ' QCM');
    await axe(page, cfg.name + ' QCM');
    await page.locator('.stage').screenshot({ path: path.join(shots, cfg.name + '-exercice-qcm.png') });
    ok(cfg.name + ' : exercices utilisables (clic réel), axe sans violation');

    // Carte mentale
    await page.selectOption('#viewsel', 'map');
    await page.waitForSelector('.mapnode.branch');
    await page.click('[data-node="cuisine"]');
    await page.waitForSelector('.mapnode.sub');
    await page.click('[data-node="cuisine/cuisiniere"]');
    await page.waitForSelector('.mapnode.leaf');
    var nodes = await page.$$eval('.mapnode', function (ns) { return ns.map(function (n) { var r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, t: n.textContent }; }); });
    var frame = await page.$eval('#mapframe', function (f) { var r = f.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    var pairs = 0;
    for (var a = 0; a < nodes.length; a++) {
      assert.ok(nodes[a].x >= frame.x && nodes[a].x + nodes[a].width <= frame.x + frame.width + 1, cfg.name + ' bulle hors cadre : ' + nodes[a].t);
      for (var b = a + 1; b < nodes.length; b++) if (overlaps(nodes[a], nodes[b])) pairs++;
    }
    assert.strictEqual(pairs, 0, cfg.name + ' : ' + pairs + ' bulles se chevauchent');
    var panelInside = await page.evaluate(function () { var p = document.querySelector('.mappanel'); return !p.hidden && document.getElementById('mapframe').contains(p); });
    assert.ok(panelInside, 'panneau dans le cadre');
    var pr = await page.$eval('.mappanel', function (p) { var r = p.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    nodes.forEach(function (nd) { assert.ok(!overlaps(nd, pr), cfg.name + ' : le panneau cache la bulle « ' + nd.t + ' »'); });
    await page.locator('#mapframe').screenshot({ path: path.join(shots, cfg.name + '-carte-mentale.png') });
    await page.click('.mappanel button');
    // glisser une bulle
    var leaf = page.locator('.mapnode.leaf').first();
    var bb = await leaf.boundingBox();
    var before = await leaf.evaluate(function (e) { return e.style.left + e.style.top; });
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 + 30, bb.y + bb.height / 2 + 25, { steps: 5 });
    await page.mouse.up();
    var after = await leaf.evaluate(function (e) { return e.style.left + e.style.top; });
    assert.notStrictEqual(after, before, 'la bulle a bougé');
    await axe(page, cfg.name + ' carte');
    await noHScroll(page, cfg.name + ' carte');
    ok(cfg.name + ' : carte mentale sans chevauchement, glisser-déposer, panneau dans le cadre');

    // Galerie et réglages extrêmes (texte très grand + dyslexie)
    await page.selectOption('#viewsel', 'free');
    await page.click('#settings summary');
    await page.selectOption('#sizesel', 'xlarge');
    await page.check('#dys');
    await page.check('#hc');
    await noHScroll(page, cfg.name + ' galerie texte très grand');
    await page.screenshot({ path: path.join(shots, cfg.name + '-galerie-reglages.png'), fullPage: false });
    await axe(page, cfg.name + ' galerie contraste renforcé');
    ok(cfg.name + ' : galerie en texte très grand + dyslexie + contraste, sans débordement');

    // Persistance IndexedDB après rechargement
    await page.reload();
    await page.waitForSelector('#app h1');
    await page.waitForTimeout(200);
    var persisted = await page.evaluate(function () { var s = APP.state(); return s.settings.size === 'xlarge' && s.view === 'free' && !!s.progress.p1.maison.seen; });
    assert.ok(persisted, 'état conservé après rechargement');
    ok(cfg.name + ' : réglages et progression conservés après rechargement (IndexedDB)');

    // Export ZIP puis restauration
    await page.click('#datapanel summary');
    var dl = page.waitForEvent('download');
    await page.click('#expzip');
    var file = await (await dl).path();
    await page.evaluate(function () { localStorage.clear(); });
    await page.selectOption('#langsel', 'es');
    await page.setInputFiles('#importfile', { name: 's.zip', mimeType: 'application/zip', buffer: fs.readFileSync(file) });
    await page.waitForFunction(function () { return APP.state().lang === 'fr'; });
    var dl2 = page.waitForEvent('download');
    await page.click('#expcsv');
    var csv = fs.readFileSync(await (await dl2).path(), 'utf8');
    assert.ok(/^\uFEFFpseudo;piece;objet;activite/.test(csv));
    ok(cfg.name + ' : export ZIP → restauration, export CSV');

    assert.deepStrictEqual(requests, [], 'requêtes réseau : ' + requests.join(', '));
    ok(cfg.name + ' : aucune requête réseau');
    await ctx.close();
  }
  await browser.close();
  assert.deepStrictEqual(errors, [], errors.join('\n'));
  console.log('navigateur : ' + passed + ' tests réussis, captures dans rapport/captures/');
})().catch(function (e) { console.error(e.message || e); process.exit(1); });
