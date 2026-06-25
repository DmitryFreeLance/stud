const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      mode: 'idle',
      history: [],
      selectedTicketId: null,
      activePromptMessageId: null
    });
  }

  return sessions.get(chatId);
}

function setMode(chatId, mode) {
  const session = getSession(chatId);
  session.mode = mode;
  return session;
}

function pushHistory(chatId, view) {
  const session = getSession(chatId);
  session.history.push(view);
  return session;
}

function popHistory(chatId) {
  const session = getSession(chatId);
  return session.history.pop();
}

function clearHistory(chatId) {
  const session = getSession(chatId);
  session.history = [];
  return session;
}

module.exports = {
  getSession,
  setMode,
  pushHistory,
  popHistory,
  clearHistory
};
