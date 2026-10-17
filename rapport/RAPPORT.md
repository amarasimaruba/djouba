# Rapport de livraison : dictionnaire visuel « la maison » (v0.2.0)

## Nouveautés de la v0.2.0
- **La cuisine** : vue d'ensemble (le réfrigérateur, la cuisinière, la hotte, le placard, le plan de travail, l'évier, le robinet), **la cuisinière** (7 parties) et **le réfrigérateur** ouvert (6 parties).
- **La salle de bain** : vue d'ensemble (8 parties), **le lavabo** (6 parties) et **les toilettes** vues de côté (6 parties).
- Les objets sont rangés par **pièce** : menu groupé, galerie en sections, carte mentale à trois niveaux, tableau de progression et export CSV avec une colonne « pièce ».
- Les intrus du QCM viennent toujours d'une autre pièce, sans nom en commun avec la pièce de l'objet.
- La carte mentale a une nouvelle disposition radiale. Sur téléphone, plus aucune bulle ne se chevauche, quelle que soit la pièce ou l'objet ouvert, dans les 4 langues.
- Les mots très longs (« le tableau de commande ») sont resserrés pour tenir dans la marge du dessin.

## Ce qui a été livré
- `dist/dictionnaire-visuel-maison.html` : fichier unique et autonome (≈ 129 Ko), sans ressource externe, sans appel réseau. Une règle CSP bloque toute connexion.
- 12 objets et 76 parties répartis en 3 pièces, chacune nommée, fléchée et définie dans 4 langues, avec 4 activités par objet.
- Les sources (`src/`), le build et les tests (`tests/`). Les captures d'écran sont dans `rapport/captures/`.

## Tests réellement lancés (tous réussis)
| Suite | Contenu | Résultat |
|---|---|---|
| Contrôles du build (`src/checks.js`) | 4 langues complètes, articles, flèches visant une partie visible (test de la partie dessinée au-dessus), identifiants uniques, contraste, « Croire que… », définitions qui ne donnent pas la réponse, bonnes réponses acceptées par leur validateur et mauvaises refusées, QCM sans doublons, aucun appel réseau, aucun HTML injecté | OK |
| `tests/core.test.js` | 14 tests : moteur d'essais (aide 1, aide 2, solution), validateurs, géométrie, ZIP (CRC de référence `CBF43926`), CSV (formules neutralisées), restauration sécurisée | 14/14 |
| `tests/content.test.js` | 15 tests : intrus du QCM jamais de la même pièce, recalcul indépendant du contraste WCAG, voisinage des points visés, espacement des étiquettes, 7 tests de mutation (dont pièce inconnue et couleur en double) qui prouvent que le linter détecte les erreurs | 15/15 |
| `tests/ui.test.js` (jsdom + axe-core) | 12 parcours : découvrir, galerie par pièce, menu groupé, carte mentale pièces → objets → parties, les 3 exercices avec leurs 2 aides, fin d'activité, changement de langue, vues guidée, libre et carte mentale, réglages ; axe sans violation sur 7 états (contraste exclu, vérifié dans Chromium) | 12/12 |
| `tests/browser.test.js` (Chromium, Playwright) | Ordinateur 1100 px et mobile 390 px : 12 objets × 4 langues sans étiquette chevauchée, coupée ou posée sur le dessin ; pas de débordement horizontal ; axe avec contraste ; cibles ≥ 44 px ; clic réel ; carte mentale sans chevauchement, glisser-déposer, panneau qui ne cache aucune bulle ; texte très grand + dyslexie + contraste ; persistance IndexedDB ; export ZIP → restauration ; CSV ; zéro requête réseau | 16/16 |

## Limites et points à vérifier
- **Traductions [auto] [À VÉRIFIER] :** kréyòl, anglais et espagnol ont été traduits automatiquement. Le kréyòl suit l'orthographe **haïtienne** (« do kay la », « matla a », « zòrye a »…). Si vos élèves parlent le créole de Martinique ou de Guadeloupe, le vocabulaire doit être adapté. Certains termes sont incertains et doivent être relus par un locuteur : *papòt la* (seuil), *ti je pòt la* (judas), *ti bwa a* (petit-bois), *volè yo* (volets), *switch la* (interrupteur).
- **Contenu [À VALIDER PAR UN HUMAIN] :** les définitions sont écrites pour le primaire, mais aucun enseignant ne les a encore relues.
- **Voix :** la lecture à voix haute utilise les voix installées sur l'appareil. Il n'y a souvent aucune voix kréyòl ; l'appli le signale alors.
- **Police « dyslexie » :** aucune police n'est intégrée (le fichier reste léger). L'appli utilise OpenDyslexic si elle est installée, sinon une police proche, avec des espacements augmentés.
- **Sur téléphone,** les étiquettes du dessin sont petites (≈ 11 à 13 px). Les mêmes mots sont repris en grands boutons sous le dessin.
- **Espagnol :** la cuisinière est traduite par *la estufa* (usage d'Amérique latine), pour la distinguer de *la cocina* (la pièce). En Espagne, on dirait plutôt *la cocina* pour les deux.
- **Pas de KaTeX :** l'appli ne contient aucune formule.
- **Non testé :** Safari, Firefox, vrais téléphones et tablettes, lecteurs d'écran réels (NVDA, VoiceOver), et surtout des élèves réels.
