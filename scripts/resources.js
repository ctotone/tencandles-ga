/**
 * Lecture et consommation centralisées des ressources individuelles.
 *
 * Les valeurs persistantes restent dans l'Actor. La résolution ne conserve
 * qu'un instantané utile à l'affichage et aux contrôles du conflit.
 */

const RESOURCE_PATHS = Object.freeze({
  vice: "system.vice.available",
  virtue: "system.virtue.available"
});

export function getActorResourceState(actor) {
  const system = actor?.system;

  return {
    canUseVice: Boolean(system?.vice?.available),
    canUseVirtue: Boolean(system?.virtue?.available),
    canUseMoment: Boolean(system?.hopeDieAvailable),
    canUseLimit: Boolean(system?.brinkAvailable)
  };
}

export async function getResolutionActor(resolution) {
  if (resolution?.actorUuid) {
    const actor = await fromUuid(resolution.actorUuid);

    if (
      actor?.documentName === "Actor" &&
      actor.type === "character"
    ) {
      return actor;
    }
  }

  if (resolution?.actorId) {
    const actor = game.actors.get(resolution.actorId);

    if (actor?.type === "character") {
      return actor;
    }
  }

  return null;
}

export async function consumeActorResource(
  actor,
  resource
) {
  const path = RESOURCE_PATHS[resource];

  if (!path) {
    throw new Error(
      `tencandles-ga | Ressource inconnue : ${resource}`
    );
  }

  await actor.update({
    [path]: false
  });

  return true;
}
