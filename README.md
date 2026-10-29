## ☕ Support the Developer / Soutenir le développeur

### 🇬🇧 English
**Ten Candles – Game Assistant** is a free, community-made Foundry VTT system, developed and maintained with passion.
If you enjoy using this system and would like to support my work on Foundry VTT projects, you can buy me a coffee!
Your support is entirely optional, but always appreciated. Thank you!

### 🇫🇷 Français
**Ten Candles – Game Assistant** est un système Foundry VTT communautaire et gratuit, développé et maintenu avec passion.
Si vous appréciez ce système et souhaitez soutenir mon travail sur mes différents projets Foundry VTT, vous pouvez m'offrir un café !
Votre soutien est entièrement facultatif, mais toujours très apprécié. Merci !

<p align="center">
  <a href="https://ko-fi.com/evilbram">
    <img src="https://storage.ko-fi.com/cdn/kofi5.png" alt="Support Evilbram on Ko-fi" height="45">
  </a>
</p>


## Nouveautés — Version 1.2.0 / What's New — Version 1.2.0

**FR — Nouveau : « Derniers Messages ».** Les joueurs enregistrent leurs derniers mots dans un dictaphone intégré au système ; le MJ peut les préécouter en privé puis les diffuser à toute la table, au moment choisi, via une playlist native Foundry au volume réglable. Les enregistrements sont sauvegardés avec un **MJ actif connecté**, verrouillés après validation et conservés par partie. La version 1.2.0 applique également la relance complète des dés d'Espoir avec la Limite et fait compter l'Instant comme brûlé dès la publication de sa carte. Merci à **Vinai** pour ses contributions aux règles et aux API.

**EN — New: “Final Messages”.** Players record their characters' final words through an integrated voice recorder; the GM can preview them privately and then play individual messages to the whole table using a native, volume-controlled Foundry playlist. Saving requires a **connected active GM**; confirmed messages are locked and archived per game. Version 1.2.0 also rerolls Hope dice when a Brink is embraced and counts a Moment as burned when its chat card is published. Thanks to **Vinai** for the rule and API contributions.

**For module developers / Pour les développeurs de modules :** [`documentation/API_1.2.0.md`](documentation/API_1.2.0.md) documents `game.evilTenCandles.transferHopeDie(fromActorId, toActorId)` (active GM only) and the optional `game.evilTenCandles.requestPlayerRoll(actorUuid, { momentRequestId })` parameter.

**Validation / Vérification :** live microphone capture and the complete multiplayer/rules regression pass are still pending. / La capture réelle au microphone et la recette complète multijoueur/règles restent à confirmer.

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## Nouveautés — Version 1.1.0 / What's New — Version 1.1.0

**FR :** Huit thèmes de canevas, manuels MJ/Joueur FR et EN, mode Accéléré facultatif et améliorations mécaniques. Voir le changelog 1.1.0.

**EN:** Eight canvas themes, FR/EN GM and Player manuals, optional Accelerated Mode and rule improvements. See the 1.1.0 changelog.

## Nouveauté — Version 1.0.1

Un accès **À propos de Ten Candles – Game Assistant** est disponible dans l’onglet Paramètres de Foundry VTT. Il affiche la version du système, les crédits, le dépôt GitHub et un lien facultatif **Buy a Coffee** vers Ko-fi. Interface localisée dans les six langues existantes.

# Système de jeu - Ten Candles – Game Assistant

## Jouez à Ten Candles sur Foundry VTT sans laisser la technique prendre le pas sur la narration

Dans *Ten Candles*, l’ambiance et la narration occupent toute la place. La dernière chose dont on a envie, c’est d’interrompre une scène pour recompter des dés ou gérer une série de manipulations techniques.

**Ten Candles – Game Assistant** est né de cette idée. Il réunit dans Foundry VTT les fiches de personnage, les pools de dés, la résolution des conflits, le suivi des bougies et les transitions entre les scènes.

Le système accompagne la partie sans jouer à votre place. Les joueurs et le MJ restent maîtres de l’histoire ; l’outil se charge simplement de tout ce qui gagne à rester discret.

![Ten Candles Game assistant](https://raw.githubusercontent.com/ctotone/JdR/refs/heads/main/.Images/foundry-tencandlesbanniere-fr.webp)

## La fiche de personnage, tout simplement

La fiche rassemble les éléments essentiels de votre personnage : son concept, sa Vertu, son Vice, son Moment et sa Limite. Elle permet d’utiliser directement les actions qui leur sont liées et de voir en un coup d’œil ce qui a déjà été joué.

Elle reste volontairement simple. Son rôle est de servir de repère pendant la partie, sans prendre plus de place que le personnage lui-même.

![Ten Candles Game assistant](https://raw.githubusercontent.com/ctotone/JdR/refs/heads/main/.Images/foundry_presenatation_fiche.webp)

## Résoudre les conflits sans casser la scène

Chaque conflit ouvre une carte interactive dans le chat.

Cette carte réunit au même endroit les résultats des dés, les relances disponibles, les cartes pouvant être brûlées, le dé d’Espoir, le pool du Maître du jeu et l’attribution de la narration.

Le joueur peut utiliser sa Vertu, son Vice ou sa Limite directement depuis cette interface. Le MJ peut également y lancer ses propres dés, valider le résultat ou annuler une résolution créée par erreur.

Toute la table suit ainsi l’évolution du conflit en temps réel, sans multiplier les fenêtres ni effectuer de calculs à la main.

Lorsque l’issue entraîne l’extinction d’une bougie, la carte accompagne également cette étape et indique combien de bougies restent allumées. Le Bal des vérités peut alors commencer autour de la table.

![Ten Candles Game assistant](https://raw.githubusercontent.com/ctotone/JdR/refs/heads/main/.Images/foundry_presenatation_roll.webp)

## Une partie qui évolue, avec ou sans canevas

Au fil d’une partie, beaucoup de choses évoluent en coulisses : les pools de dés, les cartes encore disponibles, la possibilité ou non de lancer le dé d’Espoir… Le système suit automatiquement ces changements et met à jour chaque élément quand cela est nécessaire.

Le MJ et les joueurs n’ont donc pas à garder toutes ces informations en tête ou à vérifier chaque étape. Le système prend en charge cette mécanique de fond pour que la table puisse rester concentrée sur la narration.

Pour celles et ceux qui souhaitent jouer entièrement dans Foundry, le système propose un canevas officiel. Bougies, lumières et dés y sont réunis dans une scène prête à jouer, qui évolue avec la partie.

Le MJ peut également utiliser son propre setup : vraies bougies, dés physiques, caméra, scène personnalisée ou composition vidéo. Dans ce cas, les cartes de chat s’enrichissent de quelques informations supplémentaires afin que toute la table puisse suivre l’état d’avancement de la partie.

![Ten Candles Game assistant](https://raw.githubusercontent.com/ctotone/JdR/refs/heads/main/.Images/foundry_presenatation_scene.webp)

## Une régie pensée pour le Maître du jeu

Le système intègre une régie spécialement conçue pour accompagner le MJ pendant la partie. Depuis une seule fenêtre, il peut suivre son déroulement et gérer tous ses aspects techniques sans avoir à naviguer entre plusieurs outils.

Simple et intuitive, la régie rassemble ce dont il a besoin au moment où il en a besoin. Le MJ peut ainsi garder son attention sur la table, le rythme de la partie et l’histoire qui est en train de s’écrire.

![Ten Candles Game assistant](https://raw.githubusercontent.com/ctotone/JdR/refs/heads/main/.Images/foundry_presenatation_regie.webp)

## Derniers Messages : la voix des personnages

À la fin de l'histoire, le MJ peut diffuser les messages enregistrés par les personnages, **un à un et dans l'ordre de son choix**, sans automatisme lié à l'extinction de la dernière bougie. L'accès au dictaphone se trouve au-dessus de la liste des personnages.

Chaque joueur peut enregistrer, écouter et recommencer son brouillon avant une sauvegarde définitive. L'envoi du fichier est effectué par le **MJ actif connecté**, sur le stockage persistant du système ; les messages validés sont verrouillés. Le MJ dispose d'une **préécoute locale**, d'une commande de diffusion collective et d'un réglage du volume depuis la playlist Foundry « Derniers Messages ». Les enregistrements sont conservés et séparés par partie.

**Limitations :** microphone utilisable dans un navigateur compatible en contexte sécurisé, enregistrement limité à **2 min / 6 Mio**. Supprimer une entrée depuis le dictaphone n'efface pas le fichier physique du serveur. L'audio n'est pas chiffré ; une URL de fichier accessible directement n'est pas protégée par la simple absence de bouton dans l'interface. La capture avec un micro réel et tous les scénarios multiclients restent à valider pour cette release.

## Jusqu’à la dernière bougie…

Du premier jet de dés à l’extinction de la dernière bougie, le système accompagne la table tout au long de la partie, sans jamais prendre la place de celles et ceux qui racontent.

Car dans *Ten Candles*, il ne s’agit pas de savoir si les personnages vont survivre, mais de découvrir ensemble comment ils vivront leurs derniers instants. Le système est simplement là pour laisser toute la place à cette histoire, aussi belle que tragique, jusqu’à ce que la dernière lumière s’éteigne.

## Fonctionnalités principales

- **Fiches de personnage** : Concept, Vertu, Vice, Moment et Limite réunis au même endroit.
- **Conflits interactifs** : résolution complète dans le chat, jusqu’à l’attribution de la narration.
- **Pools de dés automatisés** : suivi des dés du joueur et du Maître du jeu.
- **Cartes et dé d’Espoir** : disponibilités, relances et utilisations prises en compte par le système.
- **Suivi des bougies** : gestion de leur extinction et affichage du nombre de bougies restantes.
- **Canevas officiel** : une scène prête à jouer avec bougies, lumières et dés.
- **Dispositif personnalisé** : bougies physiques, caméra ou scène personnelle restent pleinement compatibles.
- **Régie du Maître du jeu** : les principaux outils techniques réunis dans une seule interface.
- **Derniers Messages vocaux** : enregistrement joueur, préécoute privée MJ, diffusion via playlist Foundry et archivage par partie.

## Informations

- **Compatibilité :** Foundry VTT 14
- **Langues :** FR, EN, DE, ES, IT, PT-BR
- **Prérequis :** posséder le jeu original [*Ten Candles*](https://cavalrygames.com/ten-candles), disponible auprès de Cavalry Games.

Ce système accompagne les règles de *Ten Candles*, mais ne les contient pas et ne remplace pas le jeu original.

*Ten Candles* est une création de Stephen Dewey / Cavalry Games. Ce projet communautaire n’est ni affilié ni approuvé officiellement par les ayants droit.
