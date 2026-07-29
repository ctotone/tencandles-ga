/**
 * Verrou local du MJ actif pour les transitions qui remplacent l'état global.
 */

let partyLifecycleOwner = null;

export function tryLockPartyLifecycle(owner) {
  if (!owner || partyLifecycleOwner) return false;
  partyLifecycleOwner = owner;
  return true;
}

export function unlockPartyLifecycle(owner) {
  if (partyLifecycleOwner === owner) {
    partyLifecycleOwner = null;
  }
}

export function isPartyLifecycleLocked() {
  return Boolean(partyLifecycleOwner);
}

