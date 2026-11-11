---
description: Crée un nouveau cours djouba à partir du modèle vide, après avoir demandé le sujet
---

Avant toute chose, demande à l'utilisateur le sujet ou le thème du cours, avec le niveau (tous, maternelle, primaire, collège ou lycée). Pose une seule question. N'écris rien et ne cherche rien avant sa réponse.

Ensuite :

1. Cherche des sources à jour et sérieuses sur le sujet (recherche web), avant d'écrire.
2. Crée le cours : `npm run nouveau-cours -- <identifiant> <niveau>`.
3. Remplis `src/courses/<identifiant>.json` : titre, étapes, exercice par étape, dans les quatre langues (`fr`, `kr`, `en`, `es`). Une étape par grand temps du sujet, une dernière étape « Pour aller plus loin » avec les sources.
4. Chaque exercice a 3 réponses et exactement 2 aides. Varie la place de la bonne réponse.
5. Applique `/ecriture` : mots simples, pas de tiret long, pas de « pas X mais Y ».
6. Écris sans chiffre inventé : si une donnée n'a pas de source, reste vague et dis-le.
7. Lance `npm test`, puis `npm run build`, et ouvre `dist/djouba.html` pour vérifier le menu d'étapes et l'onglet Exercice.
8. Travaille sur une branche à part. Ne fusionne qu'après l'accord de l'utilisateur.
9. Dis à l'utilisateur que le kréyòl est à faire relire par lui, et envoie-lui le fichier `dist/djouba.html`.
