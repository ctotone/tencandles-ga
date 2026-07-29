# DOCUMENT C — MANUEL DU JOUEUR

# Utiliser Ten Candles – Game Assistant dans Foundry VTT

Ce guide présente les fonctions du système accessibles aux joueurs.

Il ne remplace pas les règles de **Ten Candles**. Il indique simplement où
trouver les outils utiles et comment les utiliser dans Foundry VTT.

---

# PAGE 1 — REPÈRES DU SYSTÈME

## Les espaces essentiels

Le système s’utilise principalement depuis trois espaces :

- **la fiche de personnage**, pour consulter et utiliser les éléments de votre
  personnage ;
- **les cartes de chat**, pour suivre les conflits et effectuer les actions qui
  vous sont proposées ;
- **le canevas** (scène affichée), lorsqu’il est utilisé par le MJ, pour visualiser les bougies
  et les dés disponibles.

## Les automatismes

Le système calcule automatiquement le nombre de dés à lancer, effectue les
relances, actualise les ressources du personnage et applique les conséquences
validées par le MJ.

Les décisions narratives et les échanges entre les participants restent
effectués oralement.

## Dés 3D avec Dice So Nice !

Le système est compatible avec le module **Dice So Nice !**, qui permet
d’afficher les lancers sous la forme de dés 3D.

Sa configuration est accessible depuis **Paramètres** (barre d’icônes à
droite), puis **Paramètres de la partie** et **Dice So Nice !**. Chaque joueur
peut y personnaliser ses propres dés.

Si vous ne souhaitez pas afficher les dés 3D, vous pouvez désactiver leur
affichage dans cette configuration. Les lancers et toutes les autres
fonctionnalités du système resteront pleinement fonctionnels.

## Le Maître du jeu actif

Un compte MJ doit être connecté pour que le système puisse traiter les conflits
et les autres actions collectives.

---

# PAGE 2 — PRÉPARER SON PERSONNAGE

## Ouvrir la fiche

Votre personnage se trouve dans l’onglet **Personnages** de la barre latérale
droite de Foundry. Ouvrez sa fiche en cliquant sur son nom.

Si vous ne pouvez pas ouvrir ou modifier votre personnage, demandez au MJ de
vérifier vos droits d’accès.

## Remplir la fiche

Durant la phase de création de personnage, complétez directement :

- le nom et le Concept ;
- la Vertu ;
- le Vice ;
- l’Instant ;
- la Limite.

Les modifications sont enregistrées automatiquement.

## Modifier le portrait

Cliquez sur le portrait pour choisir une autre image. Le nom du personnage est
repris dans les cartes et les messages du système.

## Organiser les cartes

Les poignées situées dans l’en-tête de Vertu, Vice et Instant permettent de
modifier leur ordre par glisser-déposer.

La Limite conserve toujours sa position en bas de la fiche.

---

# PAGE 3 — UTILISER LA FICHE

## Vertu et Vice

Le bouton de chaque carte indique si elle est disponible ou brûlée.

Utilisez ce bouton pour modifier manuellement son état, après confirmation. Pour
employer réellement une Vertu ou un Vice pendant un conflit, utilisez le bouton
présent dans la carte de chat.

Une modification effectuée depuis la fiche pendant un conflit ne sera prise en
compte qu’au conflit suivant.

## Instant

Le bouton de la carte Instant permet :

- de déclencher l’Instant ;
- de retirer une demande encore en attente ;
- de réinitialiser un Instant déjà résolu.

Son intitulé indique directement son état actuel.

**Gardez à l'esprit que le contenu de la carte Instant sera affichée** 
**dans le chat et visible par tous au moment de son utilisation.**

## Limite

La carte affiche automatiquement **Limite verrouillée** ou **Limite
disponible**. Aucune modification manuelle n’est nécessaire.

## État de la partie

Dépliez **État actuel de la partie**, en bas de la fiche, pour consulter :

- les bougies allumées ;
- les dés joueurs disponibles ;
- les dés du MJ ;
- la phase actuelle.

Ces informations sont communes à tous les personnages.

---

# PAGE 4 — RÉSOUDRE UN CONFLIT

## Lancer les dés

Vous pouvez lancer un conflit depuis :

- le grand bouton de votre fiche ;
- le bouton flottant **Lancer les dés** présent dans la scène ;
- l’outil **Lancer un conflit Ten Candles** du groupe Tokens, dans la barre
  d’outils située à gauche.

Le nombre de dés à lancer est calculé automatiquement.

Si vous utilisez un accès depuis la scène, le système recherche votre
personnage ou le token que vous contrôlez. Une fenêtre de sélection apparaît si
plusieurs personnages sont disponibles.

## Utiliser la carte de conflit

Après le lancer, une carte apparaît dans le chat. Elle présente les dés, le
résultat provisoire et les actions encore disponibles.

Si vous souhaitez utiliser votre Vertu, votre Vice ou votre Limite, cliquez
directement sur le bouton correspondant. Le système applique la mécanique de la
ressource et actualise la carte.

Ces boutons sont accessibles au joueur ayant lancé le conflit et au MJ. Les
autres joueurs peuvent consulter la carte.

## Attendre la validation

Le résultat affiché reste provisoire jusqu’à sa validation par le MJ. Une fois
le conflit validé, la carte est verrouillée et ses conséquences sont appliquées
automatiquement.

Si vous souhaitez reprendre volontairement la narration lorsqu’elle vous est
proposée, indiquez votre décision au MJ. Il déclenchera la transition depuis la
carte de conflit ou la régie.

---

# PAGE 5 — GÉRER UN INSTANT

## Déclencher l’Instant

Cliquez sur **Déclencher l’Instant** dans votre fiche, puis confirmez la
demande.

Si un conflit est en cours, la demande est placée en attente et sera présentée
automatiquement après sa résolution.

## Retirer une demande

Tant que la carte d’Instant n’a pas encore été publiée dans le chat, cliquez sur
**Instant en attente…** dans votre fiche pour retirer la demande.

## Résoudre l’Instant

Résolvez la situation comme un conflit habituel. Une fois son issue connue,
cliquez sur **Réussite** ou **Échec** dans la carte d’Instant.

Le système actualise automatiquement votre fiche. Le MJ peut également utiliser
ces boutons.

Si la carte est suspendue par un nouveau conflit, attendez la fin de celui-ci :
elle sera proposée de nouveau automatiquement.

## Réinitialiser l’Instant

Après sa résolution, utilisez le bouton de la carte Instant dans votre fiche
pour revenir à son état initial.

Cette action retire l’éventuel dé d’Espoir et actualise la disponibilité de la
Limite.

---

# PAGE 6 — TERMINER UNE SCÈNE

## Échec d’un conflit

Lorsqu’un échec met fin à la scène, une carte **Bal des vérités** apparaît dans
le chat.

Le MJ déclenche la transition. Le système actualise alors les bougies, les dés
disponibles et le canevas.

## Bal des vérités

Le nombre de vérités à énoncer est indiqué dans la carte. Le Bal se déroule
oralement : aucune saisie n’est demandée dans Foundry.

Une fois le Bal terminé, la scène suivante peut commencer.

## Reprise de la narration

Si vous reprenez volontairement la narration, le MJ valide votre décision dans
le système. La bougie est éteinte et la carte du Bal des vérités est publiée
automatiquement.

---

# PAGE 7 — LA DERNIÈRE BOUGIE

## Lancer le dernier dé

À la dernière bougie, le bouton principal de la fiche affiche :

> **Lutter encore et toujours...**

Utilisez-le comme pour les conflits précédents. Le système gère automatiquement
le dernier dé disponible.

## Réussite

En cas de réussite, le conflit est validé normalement et la dernière bougie
continue de brûler.

## Échec

En cas d’échec, le départ du personnage est appliqué automatiquement et une
carte narrative apparaît dans le chat.

Aucune action supplémentaire n’est nécessaire dans Foundry.

---

# PAGE 8 — AMÉLIORATION ET BUG

Un grand soin a été mis dans la réalisation de ce système de jeu Ten Candles - Game assistant afin de mettre au centre de la partie la narration, l'immersion et minimiser au maximum les interactions techniques avec la fiche de personnage ou l'environnement de jeu.

Cependant si vous aviez des axes d'amélioration, ou si vous rencontriez des bugs, n'hésitez pas à les faire remonter sur le dépôt GitHub du projet (https://github.com/ctotone/evil-tencandles-system/issues)
