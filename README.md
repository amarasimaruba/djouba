# Mon dictionnaire visuel : la maison

Application éducative **hors ligne** (un seul fichier HTML) pour apprendre le champ lexical de la maison, niveau primaire, à la manière d'un dictionnaire visuel : chaque objet est dessiné, et chaque partie est **nommée et fléchée**.

- **Fichier à ouvrir :** `dist/dictionnaire-visuel-maison.html` (double-clic, aucun Internet nécessaire, aucune donnée envoyée).
- **3 pièces, 12 objets, 76 parties :**
  - *La maison et ses meubles* : la maison (extérieur), la porte, la fenêtre, le lit, la chaise, la lampe ;
  - *La cuisine* : la cuisine (vue d'ensemble), la cuisinière, le réfrigérateur ;
  - *La salle de bain* : la salle de bain (vue d'ensemble), le lavabo, les toilettes.
- **4 langues :** français (langue source), kréyòl, anglais, espagnol. Ces trois dernières sont des traductions automatiques marquées **[auto]**, à faire relire.

## Activités (par objet)
1. **Découvrir** : planche fléchée complète. Toucher un mot ou une partie affiche sa définition et permet de l'écouter (si l'appareil a une voix pour la langue).
2. **Montre-moi** : un mot est donné, l'élève touche la bonne partie du dessin.
3. **Nomme la flèche** : une flèche montre « ? », l'élève choisit le mot dans un menu déroulant.
4. **Coche les bonnes parties** : QCM à cases à cocher, avec des intrus pris dans les autres objets.

Dans chaque exercice : **aide 1** après le 1er échec, **aide 2** après le 2e, **solution** seulement après le 3e échec (ou une réussite). En fin d'activité, l'appli affiche le score obtenu du premier coup et une idée reçue (« Croire que… »).

## Affichage et accessibilité
- Trois affichages : **guidé** (pas à pas, menu groupé par pièce), **libre** (galerie rangée par pièce), **carte mentale** à trois niveaux (pièces → objets → parties). Les bulles se déplacent à la souris, au doigt ou au clavier ; les mots d'un objet restent cachés tant que l'élève n'a pas ouvert « Découvrir » pour cet objet.
- Dans le QCM, les intrus viennent toujours d'une **autre pièce** et ne portent jamais un nom présent dans la pièce de l'objet. Par exemple, « le robinet » n'est jamais un intrus pour la cuisine.
- Réglages : taille du texte, police adaptée à la dyslexie, contraste renforcé, sans animation.
- Une couleur par objet (contraste vérifié), cibles tactiles d'au moins 44 px, pas de défilement horizontal à 390 px.

## Profils et données
Profils locaux identifiés par un pseudonyme, avec une progression par profil, enregistrés dans IndexedDB (ou en mémoire si le navigateur l'interdit). On peut exporter et restaurer une sauvegarde ZIP, et faire un export CSV pour l'enseignant. **Il n'y a pas de contrôle d'accès réel** : les données restent sur l'appareil.

## Développement
```bash
npm install          # jsdom, axe-core, playwright (tests uniquement)
npm run build        # contrôles bloquants puis génération de dist/
npm test             # build + tests du noyau, du contenu et de l'interface (jsdom + axe-core)
npm run test:browser # Chromium : captures, chevauchements, mobile 390 px, axe avec contraste
```

Structure :
- `src/content.js` : objets, dessins, mots et définitions en 4 langues, textes de l'interface.
- `src/core.js` : validateurs, moteur d'essais, linter, stockage, ZIP, CSV.
- `src/mindmap.js` : la carte mentale.
- `src/app.js` : l'interface.
- `src/template.html` : le modèle de page et le CSS.
- `src/checks.js` : les contrôles bloquants.

**Ajouter un objet :** ajouter une entrée dans `CONTENT.objects`, avec sa pièce (`room`, à déclarer dans `CONTENT.rooms`), les formes de chaque partie, le point visé par la flèche (`a`), un décor facultatif (`deco` : mur, sol… ni cliquable ni étiqueté) et les textes en 4 langues. Le build refuse un contenu incomplet ou incohérent (traduction ou article manquant, flèche qui vise une partie cachée, identifiant en double, contraste insuffisant, idée reçue mal formulée…).
