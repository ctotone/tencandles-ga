/**
 * Notifications ciblées vers l'utilisateur ayant demandé une action.
 */

import { SOCKET_NAME } from "./constants.js";

export function notifyRequester(
  requesterId,
  level,
  message
) {
  const normalizedLevel = ["info", "warn", "error"].includes(level)
    ? level
    : "info";

  if (requesterId === game.user.id) {
    ui.notifications[normalizedLevel]?.(message);
    return;
  }

  game.socket.emit(SOCKET_NAME, {
    type: "notification",
    targetId: requesterId,
    level: normalizedLevel,
    message
  });
}
