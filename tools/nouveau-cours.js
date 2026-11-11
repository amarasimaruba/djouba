// Crée un cours vide à partir de modeles/cours-vide.json et l'inscrit dans l'index.
// Usage : npm run nouveau-cours -- <identifiant> <niveau>
const fs = require('node:fs');
const path = require('node:path');

function create(root, id, level) {
  if (!/^[a-z0-9-]+$/.test(id || '')) throw new Error('Identifiant : lettres minuscules, chiffres et tirets seulement.');
  const idxPath = path.join(root, 'src', 'courses', 'index.json');
  const index = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  if (!index.levels.includes(level)) throw new Error('Niveau inconnu : ' + level + '. Choix : ' + index.levels.join(', '));
  if (index.courses.some((c) => c.id === id)) throw new Error('Ce cours existe déjà : ' + id);
  const dest = path.join(root, 'src', 'courses', id + '.json');
  if (fs.existsSync(dest)) throw new Error('Le fichier existe déjà : ' + dest);
  const tpl = JSON.parse(fs.readFileSync(path.join(root, 'modeles', 'cours-vide.json'), 'utf8'));
  delete tpl._notes;
  fs.writeFileSync(dest, JSON.stringify(tpl, null, 2) + '\n');
  index.courses.push({ id, level, file: id + '.json' });
  fs.writeFileSync(idxPath, JSON.stringify(index, null, 2) + '\n');
  return dest;
}

if (require.main === module) {
  try {
    console.log('Créé : ' + create(path.join(__dirname, '..'), process.argv[2], process.argv[3]));
    console.log('Remplir les 4 langues, puis lancer npm test.');
  } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { create };
