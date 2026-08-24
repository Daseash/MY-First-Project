const sessions = new Map(); // sessionId -> { history: [], lastActive: Date }
const MAX_TURNS = 6;
const EXPIRY_MS = 30 * 60 * 1000; // 30 min

function getHistory(sessionId) {
  cleanup();
  const s = sessions.get(sessionId);
  return s ? s.history : [];
}

function addTurn(sessionId, role, content) {
  const s = sessions.get(sessionId) || { history: [], lastActive: Date.now() };
  s.history.push({ role, content });
  if (s.history.length > MAX_TURNS * 2) {
    s.history = s.history.slice(-MAX_TURNS * 2);
  }
  s.lastActive = Date.now();
  sessions.set(sessionId, s);
}

function cleanup() {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.lastActive > EXPIRY_MS) {
      sessions.delete(id);
    }
  }
}

module.exports = { getHistory, addTurn };
