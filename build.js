/* Construit dist/dictionnaire-visuel-maison.html : un seul fichier autonome, sans ressource externe. */
var fs = require('fs');
var path = require('path');
var checks = require('./src/checks.js');
var pkg = require('./package.json');

var dir = path.join(__dirname, 'src');
function read(f) { return fs.readFileSync(path.join(dir, f), 'utf8'); }
var sources = { 'core.js': read('core.js'), 'content.js': read('content.js'), 'mindmap.js': read('mindmap.js'), 'app.js': read('app.js') };

var errors = checks.run(sources);
if (errors.length) {
  console.error('BUILD ÉCHOUÉ : ' + errors.length + ' erreur(s)');
  errors.forEach(function (e) { console.error(' - ' + e); });
  process.exit(1);
}

var config = 'var APP_CONFIG = ' + JSON.stringify({ version: pkg.version, module: 'maison' }) + ';';
var html = read('template.html');
var parts = { CONFIG: config, CORE: sources['core.js'], CONTENT: sources['content.js'], MAP: sources['mindmap.js'], APP: sources['app.js'] };
Object.keys(parts).forEach(function (k) {
  if (html.indexOf('{{' + k + '}}') === -1) { console.error('Emplacement {{' + k + '}} absent du modèle'); process.exit(1); }
  html = html.split('{{' + k + '}}').join(function () { return parts[k]; }());
});
if (/\{\{[A-Z]+\}\}/.test(html)) { console.error('Emplacement non remplacé'); process.exit(1); }
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
var out = path.join(__dirname, 'dist', 'dictionnaire-visuel-maison.html');
fs.writeFileSync(out, html);
console.log('OK : ' + path.relative(__dirname, out) + ' (' + Math.round(html.length / 1024) + ' Ko), contrôles passés.');
