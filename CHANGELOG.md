# Changelog — Ten Candles – Game Assistant

## 1.2.0 — Derniers Messages, règles et API / Final Messages, rules and API — 29 octobre 2026

### Français

#### Nouveauté principale — « Derniers Messages » : dictaphone intégré

- **Enregistrez les derniers mots de vos personnages** dans une fenêtre immersive accessible depuis l'onglet Personnages, aussi bien pour les joueurs que pour le MJ. Un texte d'inspiration aide à imaginer un ultime appel, une demande d'aide ou un adieu.
- **Enregistrement à la demande** : autorisation explicite du microphone, arrêt, réécoute du brouillon avec compteur de lecture, suppression et nouvel essai avant validation. Limites actuelles : **2 minutes et 6 Mio** par message. Un navigateur compatible et un contexte sécurisé (HTTPS ou localhost) sont requis pour le microphone.
- **Sauvegarde définitive et verrouillage** : le joueur confirme son message ; celui-ci est transmis via le **MJ actif connecté**, qui enregistre le fichier dans le stockage persistant du système. Le joueur ne peut ensuite plus le modifier ni le réécouter. Le MJ peut retirer un message de la liste, permettant au personnage concerné de réenregistrer.
- **Écoute privée et diffusion à la table** : le MJ peut préécouter localement chaque message (icône casque), puis choisir le moment de sa diffusion individuelle. La lecture collective s'appuie sur une **Playlist native Foundry**, avec volume réglable dans l'onglet Playlists, sans enchaînement automatique ni déclenchement à la dernière bougie.
- **Archivage par partie** : chaque message est rattaché à l'identifiant de la partie (`gameId`). Les fichiers des anciennes parties restent sur le serveur et ne se mélangent pas avec ceux de la partie en cours. Retirer une entrée de la liste **n'efface pas physiquement le fichier audio**.
- **Interface localisée dans six langues** (FR, EN, DE, ES, IT, PT-BR). L'accès à la lecture et à la suppression des messages validés est réservé au MJ dans l'interface. Le système ne promet pas de confidentialité contre l'accès direct aux URL des fichiers.

#### Ajustements des règles — contributions de Vinai

- **PR [#4](https://github.com/ctotone/tencandles-ga/pull/4) — Embrasser sa Limite :** la relance concerne désormais **l'intégralité du jet**, y compris tous les dés d'Espoir. Les anciens résultats, même les 6, sont abandonnés. Cette règle est appliquée directement, **sans nouveau paramètre optionnel** ; le mode Accéléré ne transforme toujours pas les dés d'Espoir.
- **PR [#5](https://github.com/ctotone/tencandles-ga/pull/5) — Instant :** l'Instant est considéré comme brûlé **dès la publication effective** de sa carte de chat, avant le jet. Si un conflit est déjà en cours, la demande reste en attente et ne brûle l'Instant qu'à sa publication après la fin de ce conflit. Avec Vice et Vertu déjà consommés, la Limite peut donc devenir disponible immédiatement. Le résultat de l'Instant (réussite/échec) est toujours réglé ensuite dans sa carte.

#### API pour les modules externes — contributions de Vinai

- **PR [#6](https://github.com/ctotone/tencandles-ga/pull/6)** — `game.evilTenCandles.transferHopeDie(fromActorId, toActorId)` : transfère un dé d'Espoir entre deux **IDs d'Actors du monde**, **pas des UUID**. Retourne une `Promise` résolue avec `{ giver, receiver }` (documents Actor). L'appel est **réservé au client MJ actif**, hors conflit et sous verrou de partie ; les validations habituelles de la régie sont conservées. Aucun contrôle joueur ajouté.
- **PR [#5](https://github.com/ctotone/tencandles-ga/pull/5)** — `game.evilTenCandles.requestPlayerRoll(actorUuid, { momentRequestId })` : paramètre facultatif permettant d'associer un jet de conflit à **une demande d'Instant du même personnage déjà publiée**. `actorUuid` est un UUID d'Actor ; `momentRequestId` est l'identifiant de la demande (et non l'ID de sa carte de chat). L'appel est transmis au MJ actif, qui vérifie les droits d'utilisation de l'Actor, l'existence de la demande et l'absence d'association déjà active. Une valeur invalide est refusée avant le jet. Ce paramètre **ne brûle pas une deuxième fois** l'Instant et ne change pas les jets ordinaires sans option.
- **Documentation des signatures, préconditions et exemples** : [`documentation/API_1.2.0.md`](documentation/API_1.2.0.md).

**Merci à Vinai** pour ses PR #4, #5 et #6, son examen attentif des règles et ses propositions de code. Les contributions ont été relues et adaptées aux choix de Ten Candles – Game Assistant.

### English

#### Headline feature — “Final Messages” built-in voice recorder

- **Record your characters' final words** in a dedicated, immersive recorder opened from the Actors sidebar. A short prompt suggests a final call, plea for help, or farewell.
- **Opt-in recording** with explicit microphone permission, stop, draft playback with a live timer, discard and retry. Current limits: **2 minutes and 6 MiB** per message. Microphone capture requires a supported browser and a secure context (HTTPS or localhost).
- **Final save and lock**: the player confirms their message; the **connected active GM** relays its upload to the system's persistent storage. Once saved, the player can no longer edit or replay it. The GM may remove a saved entry so that character can record again.
- **Private GM preview and table-wide playback**: the GM can check any recorded message locally, then play individual messages on demand through a **native Foundry Playlist**, with volume control in the Playlists sidebar. Playback is never chained or triggered automatically by the final candle.
- **Per-game archiving**: recordings are indexed by `gameId`; previous games' files remain on the server but do not appear in the current game's list. Removing a message entry **does not physically delete its audio file**.
- **Six interface languages** (FR, EN, DE, ES, IT, PT-BR). Saved-message play/delete controls are GM-only in the interface. Direct file URLs are not guaranteed to be private.

#### Rule adjustments — contributions from Vinai

- **PR [#4](https://github.com/ctotone/tencandles-ga/pull/4) — Embracing a Brink:** reroll **the entire pool**, including every Hope die, even previously rolled sixes. This is now the standard rule **without an additional world setting**. Accelerated Mode still never transforms Hope dice.
- **PR [#5](https://github.com/ctotone/tencandles-ga/pull/5) — Living a Moment:** the Moment counts as burned **when its chat card has actually been published**, before the roll. Requests queued during an active conflict only count as burned after that conflict ends and the card is published. With Vice and Virtue already burned, the Brink can become available immediately. The Moment's success/failure is still resolved separately through its chat card.

#### API additions for external modules — contributions from Vinai

- **PR [#6](https://github.com/ctotone/tencandles-ga/pull/6)** — `game.evilTenCandles.transferHopeDie(fromActorId, toActorId)` transfers one Hope die using **world Actor IDs (not UUIDs)**. Returns a `Promise` resolving to `{ giver, receiver }` (Actor documents). **Active GM client only**, with no active conflict and the existing party-lock and recipient checks. No extra player-facing controls.
- **PR [#5](https://github.com/ctotone/tencandles-ga/pull/5)** — `game.evilTenCandles.requestPlayerRoll(actorUuid, { momentRequestId })` optionally associates a conflict roll with an **already-published Moment request belonging to the same Actor**. `actorUuid` is an Actor UUID, whereas `momentRequestId` is the request's ID (not its chat-message ID). The active GM validates permissions, the request and whether it is already linked to another roll. Invalid associations are rejected before rolling. The option **does not burn the Moment a second time**; existing calls without options are unchanged.
- **API signatures, preconditions and examples:** [`documentation/API_1.2.0.md`](documentation/API_1.2.0.md).

**Thanks to Vinai** for PRs #4, #5 and #6, for reviewing the rules so carefully, and for sharing practical implementations. The changes have been reviewed and adapted to the project's design choices.

**Validation note:** local checks and some live Foundry feedback cover parts of the recorder (including private preview and group playback), but **end-to-end microphone recording has not been retested for 1.2.0**. Multiclient behavior, browser compatibility, and the updated rules/APIs still need real-session verification.

## 1.1.0 — Nouveautés et correctifs / Features and fixes

### Français

- **Huit thèmes pour le canevas officiel :** Classique, Forêt enfant, Futuriste, Lovecraft, Magie, Médiéval, Post-apocalyptique et Western. Le MJ peut choisir l'ambiance visuelle depuis la régie ; les bougies, flammes et lumières s'adaptent au thème sélectionné.
- **Manuels en français et en anglais :** les guides du MJ et du Joueur sont disponibles dans les deux langues dans le compendium du système.
- **Nouveau mode Accéléré (facultatif) :** conçu pour favoriser des parties plus courtes grâce à une perte plus rapide des dés joueurs. Pendant les jets concernés, chaque paire de dés joueurs affichant **2** est traitée comme **1 et 2**, ce qui accélère l'attrition. Le MJ choisit jusqu'à quelle bougie incluse cette variante s'applique (6e bougie par défaut). Le mode Classique reste disponible.
- Martyre : transfert des dés d’Espoir entre personnages, exclusivement via la régie MJ, et prise en charge de plusieurs dés d’Espoir.
- Égalités des 6 : priorité de narration au MJ (sauf jet MJ ignoré), avec possibilité pour le joueur de reprendre la narration.
- Échec après relance de Limite : Limite consumée et dés d’Espoir perdus ; état visible et corrigeable dans la régie MJ.
- Adaptations compatibles avec le mode Accéléré ; dés d’Espoir exclus de sa transformation.
- Correctifs issus des PR #1, #2 et #3 proposés par **Vinai**, adaptés à la version 1.1.0.

### English

- **Eight official canvas themes:** Classic, Children's Forest, Futuristic, Lovecraft, Magic, Medieval, Post-Apocalyptic, and Western. The GM can select a visual atmosphere from the control panel; candles, flames, and lights adapt to the selected theme.
- **French and English manuals:** both the GM's Guide and the Player's Guide are available in both languages in the system compendium.
- **New optional Accelerated Mode:** helps support shorter sessions by making players' dice pools shrink more quickly. On applicable player rolls, every pair of dice showing **2** is treated as **1 and 2**, accelerating dice loss. The GM can choose the last candle on which this rule applies (the sixth candle by default). Classic Mode remains available.
- Martyrdom: GM-only Hope die transfers through GM control and support for multiple Hope dice.
- Tied sixes: narration goes to the GM (unless the GM roll was skipped), with the player able to seize narration.
- Failed Brink reroll: Brink is consumed and Hope dice are lost; the state is displayed and adjustable in GM control.
- Compatible with Accelerated Mode; Hope dice are never transformed by it.
- Fixes adapted from PRs #1, #2 and #3 by **Vinai** for release 1.1.0.

## 1.0.1 — À propos et soutien facultatif

- Ajout d’une entrée « À propos de Ten Candles – Game Assistant » dans l’onglet Paramètres de Foundry VTT.
- Ajout d’une fenêtre présentant le système, sa version installée, le crédit Evilbram et le dépôt GitHub.
- Traductions ajoutées aux six langues existantes.
- Aucune modification des règles ou mécaniques de jeu.

## 1.0.0 — Version initiale

- Première version de production du système.
