// Assemble src/ en un seul fichier HTML : dist/djouba.html (aucune adresse externe).
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const src = (...p) => path.join(root, 'src', ...p);
const read = (f) => fs.readFileSync(f, 'utf8');
const LANGS = ['fr', 'kr', 'en', 'es'];
const JS_ORDER = [['i18n', 'i18n.js'], ['voice', 'voice.js'], ['courses', 'courses.js'], ['core', 'app.js']];

function build() {
  const i18n = {};
  for (const l of LANGS) i18n[l] = JSON.parse(read(src('i18n', l + '.json')));
  const index = JSON.parse(read(src('courses', 'index.json')));
  const contents = {};
  for (const c of index.courses) contents[c.id] = JSON.parse(read(src('courses', c.file)));
  const data = JSON.stringify({ i18n, courses: { index, contents } }).replace(/<\//g, '<\\/');
  const js = JS_ORDER.map(([d, f]) => read(src(d, f))).join('\n').replace(/<\/script/gi, '<\\/script');
  const html = read(src('index.html'))
    .split('{{CSS}}').join(read(src('ui', 'theme.css')))
    .split('{{DATA}}').join(data)
    .split('{{JS}}').join(js);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'djouba.html');
  fs.writeFileSync(out, html);
  return out;
}

if (require.main === module) console.log('Écrit : ' + build());
module.exports = { build };
