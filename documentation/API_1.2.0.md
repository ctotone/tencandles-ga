# Ten Candles – Game Assistant 1.2.0 — API additions / Nouveautés API

Ces extensions ont été proposées par **Vinai** (PR [#5](https://github.com/ctotone/tencandles-ga/pull/5), [#6](https://github.com/ctotone/tencandles-ga/pull/6)), puis adaptées au fonctionnement validé de Ten Candles GA. / These extensions were proposed by **Vinai** and adapted to the system's existing workflow.

Les fonctions sont exposées par `game.evilTenCandles` une fois le système initialisé (`ready`). Elles s'adressent aux **développeurs de modules**, pas aux joueurs : aucune nouvelle commande ne doit être saisie dans la console du navigateur. / Available after system `ready`, for third-party module integrations; players do not need the browser console.

## 1. Transférer un dé d'Espoir / Transfer a Hope die — PR #6

**Signature**

```js
await game.evilTenCandles.transferHopeDie(fromActorId, toActorId);
```

- `fromActorId` : **ID d'un Actor personnage du monde** qui donne un dé d'Espoir ; **pas un UUID**. / World character Actor ID of the giver; **not a UUID**.
- `toActorId` : **ID d'un autre Actor personnage du monde** qui reçoit le dé ; **pas un UUID**. / World character Actor ID of the recipient; **not a UUID**.
- **Résultat / Result :** `Promise<{ giver: Actor, receiver: Actor }>` avec les deux documents mis à jour. / Resolves with the updated Actor documents.
- **Autorité / Authorization :** appel exécuté sur le **client du MJ actif uniquement** ; refus si un conflit est en cours ou si le verrou de partie est occupé. Les Actors doivent exister dans le monde, être distincts et de type `character`; le donneur doit posséder au moins un dé d'Espoir. / Must execute on the **active GM client**; fails during an active conflict, while the party lock is busy, for invalid Actor IDs, or when no Hope die is available.
- **Erreurs / Errors :** `Promise` rejetée (`Error`) avec message localisé. La fonction ne demande pas de confirmation UI : le module appelant doit, si nécessaire, vérifier le consentement narratif du MJ **avant** l'appel. / Rejects with a localized `Error`; no confirmation dialog is added by the API.
- **Aucune délégation automatique / No automatic delegation :** un module exécuté côté joueur ne peut pas contourner la restriction MJ en appelant directement cette fonction. / Calling this function from a player client is not a GM proxy.

**Exemple / Example (dans le code d'un module tournant sur le client MJ actif / in module code running on the active GM client)**

```js
const giver = game.actors.get("WORLD_ACTOR_ID_GIVER");
const receiver = game.actors.get("WORLD_ACTOR_ID_RECEIVER");
if (giver && receiver) {
  try {
    const result = await game.evilTenCandles.transferHopeDie(giver.id, receiver.id);
    console.info("Hope die transferred", result.giver.name, result.receiver.name);
  } catch (error) {
    console.warn("Hope die transfer refused:", error.message);
  }
}
```

## 2. Associer un jet à un Instant / Associate a roll with a Moment — PR #5

**Signatures**

```js
await game.evilTenCandles.requestPlayerRoll(actorUuid);
await game.evilTenCandles.requestPlayerRoll(actorUuid, { momentRequestId });
```

- `actorUuid` : **UUID de l'Actor personnage**, par exemple `Actor.<id>`. / Character Actor **UUID**, unlike the world Actor IDs above.
- `momentRequestId` : **ID de la demande d'Instant** dans l'état collectif `instantRequests`, **pas l'ID du message de chat**. Paramètre facultatif ; omettez-le pour un conflit ordinaire. / **Moment request ID**, not the chat message ID; omit for an ordinary roll.
- **Préconditions / Preconditions :** la carte d'Instant doit avoir été **effectivement publiée** dans le chat ; la demande doit appartenir au même personnage, ne pas avoir déjà été réglée, et ne pas être associée à un autre jet. L'appel respecte les règles habituelles (propriété de l'Actor ou MJ, phase de jeu, pas d'autre résolution active, réserve de dés disponible). / The Moment request must already be **published**, belong to the same character, remain unresolved and not already be linked to another roll. Normal permissions and conflict prerequisites also apply.
- **Autorité / Authority :** l'appel passe par le flux de requête de conflit vers le **MJ actif** ; il n'accorde aucun droit supplémentaire. Une association invalide est refusée **avant le jet de dés**. / The request is handled by the **active GM**; invalid associations are rejected **before dice are rolled**.
- **Effet / Effect :** associe l'identifiant de demande à la résolution (`momentRequestId`) et mémorise l'identifiant de résolution sur la demande (`momentRollResolutionId`). **Ne brûle pas une seconde fois l'Instant** : celui-ci compte déjà comme brûlé dès publication effective de sa carte. La Limite est disponible si ses autres conditions sont réunies. / Links request and resolution; does **not** burn the Moment again. Brink availability follows the already-published Moment and other resource conditions.
- **Annulation / Cancellation :** l'annulation du conflit efface le lien `momentRollResolutionId`, **sans annuler** la consommation d'un Instant dont la carte a déjà été publiée. / Cancelling the conflict clears the association but does **not** unburn an already-published Moment.

**Exemple / Example (code d'un module / in a module integration)**

```js
const actor = game.actors.get("WORLD_ACTOR_ID");
const state = game.evilTenCandles.state.get();
const request = state.instantRequests?.find((r) =>
  r.actorId === actor?.id && r.declaredAt && !r.momentRollResolutionId
);
if (actor && request) {
  await game.evilTenCandles.requestPlayerRoll(actor.uuid, {
    momentRequestId: request.id
  });
}
```

> **Important / Note:** dans l'interface standard, la carte d'Instant publiée suffit déjà pour marquer l'Instant comme consommé. Ce paramètre API ne crée pas une demande d'Instant et ne modifie pas le parcours utilisateur. / In the standard UI, publishing the Moment card already counts as burning it; the API option does not create a Moment request or add any player-facing controls.

## Compatibilité / Compatibility

- Package : `tencandles-ga` 1.2.0, Foundry VTT v14.
- Les signatures existantes sans paramètres supplémentaires restent disponibles. / Existing calls without extra options remain supported.
- Aucune nouvelle permission joueur ni nouveau bouton de fiche. / No new player-facing permissions or sheet controls.
