const eventBus = new Map(); // userId → { res, role }

function emitEvent(userId, event) {
  const conn = eventBus.get(userId);
  if (conn) conn.res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function emitToRole(role, event) {
  eventBus.forEach((conn) => {
    if (conn.role === role || conn.role === "boss") {
      conn.res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  });
}

function sseEvent(type, session_id, data) {
  return { type, ts: Date.now(), session_id, data };
}

module.exports = { eventBus, emitEvent, emitToRole, sseEvent };
