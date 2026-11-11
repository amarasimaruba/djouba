# CLAUDE.md

Ce fichier guide Claude Code dans ce dépôt.

## Rôle du dépôt

Djouba est le socle commun des applications pédagogiques hors ligne : langues, onglets, voix et accès aux cours. Le résultat est un seul fichier HTML qui s'ouvre sans réseau.

## Commandes

- `npm run build` : assemble `src/` en `dist/djouba.html`.
- `npm test` : lance tous les tests (`node --test tests/*.test.js`).
- Un seul test : `node --test tests/langues.test.js`.
- Déploiement : copier `dist/djouba.html` sur l'appareil, le NAS ou GitHub Pages. Aucun serveur n'est requis.

Il n'y a aucune dépendance : seul Node 22 ou plus récent est nécessaire.

## Arborescence

- `src/index.html` : modèle de page, avec les repères `{{CSS}}`, `{{DATA}}` et `{{JS}}`.
- `src/ui/theme.css` : trois thèmes sombres (nuit, ardoise, forêt) et une couleur par onglet.
- `src/i18n/` : `fr.json`, `kr.json`, `en.json`, `es.json` et `i18n.js`.
- `src/courses/` : `index.json` (niveaux et cours), un fichier JSON par cours (`igname.json` est le premier), `courses.js`.
- `src/voice/voice.js` : choix de la voix et lecture.
- `src/core/app.js` : état, onglets, rendu. C'est le seul fichier qui touche à la page.
- `tools/build.js` : le build.
- `tests/` : tests Node, sans bibliothèque externe.

Le build lit les JSON et les place dans `window.DJOUBA_DATA`. Un fichier ouvert hors ligne ne peut pas charger d'autres fichiers, donc tout est intégré.

## Conventions

- Langues : codes `fr`, `kr`, `en`, `es`. Le français est la langue de repli. Les quatre fichiers de langue ont les mêmes clés.
- Aucun texte écrit en dur dans l'interface : utiliser `data-i18n` ou `t(clé)`. Les noms de langues du menu restent dans leur propre langue.
- Un cours a un titre et une liste d'étapes (`chapters`). Chaque étape a un titre et un texte dans les quatre langues. Un cours à texte unique reste accepté et devient une seule étape.
- Menus déroulants partout où c'est possible.
- Aucun clic sur du texte ou sur une zone, aucun double clic : seulement de vrais `<button>`. Tous les clics passent par `onButton` dans `app.js`.
- Couleurs : fond sombre, écriture claire, un thème au choix, une couleur par onglet. Pas de fond blanc.
- Voix : synthèse vocale du navigateur, voix locales d'abord. Le kréyòl n'a pas de voix système, on prend une voix française et on le dit à l'écran. Sans voix, l'application continue de marcher.
- Exercices : deux aides avant de donner la bonne réponse.
- Les textes des livrables suivent la commande `/ecriture` : mots simples, pas de tirets longs.

## Tests

Les tests vérifient : mêmes clés dans les quatre langues, cours valides, choix de voix, fichier final sans adresse externe, script valide, et clics réservés aux boutons. Ajouter un test pour chaque nouvelle règle de cette liste.
