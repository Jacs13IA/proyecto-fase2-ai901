const STORAGE_KEY = "certificador-tecnologias-microsoft.conversations.v1";
const MAX_CONVERSATIONS = 20;
const INITIAL_GREETING =
  "¡Hola! ¿Qué certificación o tema de Microsoft te gustaría explorar?";

const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const newChatButton = document.querySelector("#new-chat-button");
const messages = document.querySelector("#messages");
const status = document.querySelector("#chat-status");
const historyStatus = document.querySelector("#history-status");
const conversationList = document.querySelector("#conversation-list");

const pendingConversations = new Set();
let conversations = [];
let activeConversationId;
let conversationId;

function isSavedMessage(message) {
  return (
    message !== null &&
    typeof message === "object" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    typeof message.isError === "boolean"
  );
}

function isSavedConversation(conversation) {
  return (
    conversation !== null &&
    typeof conversation === "object" &&
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    (conversation.conversationId === null ||
      typeof conversation.conversationId === "string") &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(isSavedMessage) &&
    typeof conversation.updatedAt === "string"
  );
}

function loadConversations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return { items: [], activeId: undefined };
    }

    const state = JSON.parse(saved);
    if (!state || !Array.isArray(state.conversations)) {
      throw new Error("Invalid saved conversation history.");
    }

    const items = state.conversations.filter(isSavedConversation);
    if (items.length !== state.conversations.length) {
      historyStatus.textContent =
        "Algunas conversaciones guardadas no se pudieron restaurar.";
    }

    const recentItems = items
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
    const activeId =
      typeof state.activeConversationId === "string" &&
      recentItems.some((item) => item.id === state.activeConversationId)
        ? state.activeConversationId
        : Object.hasOwn(state, "activeConversationId") &&
            state.activeConversationId === null
          ? null
          : undefined;

    return {
      items: recentItems,
      activeId,
    };
  } catch {
    historyStatus.textContent =
      "No se pudo leer el historial del navegador. Puedes seguir usando el chat.";
    return { items: [], activeId: undefined };
  }
}

function saveConversations() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        conversations,
        activeConversationId: activeConversationId ?? null,
      }),
    );
    historyStatus.textContent = "";
  } catch {
    historyStatus.textContent =
      "No se pudo guardar el historial. Revisa el espacio disponible del navegador.";
  }
}

function currentConversation() {
  return conversations.find((item) => item.id === activeConversationId);
}

function sortAndLimitConversations() {
  conversations.sort(
    (first, second) => second.updatedAt.localeCompare(first.updatedAt),
  );
  conversations = conversations.slice(0, MAX_CONVERSATIONS);

  if (!conversations.some((item) => item.id === activeConversationId)) {
    activeConversationId = undefined;
    conversationId = undefined;
  }
}

function formatConversationDate(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}

function renderConversationList() {
  conversationList.replaceChildren();

  if (conversations.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Tus conversaciones aparecerán aquí.";
    conversationList.append(empty);
    return;
  }

  for (const conversation of conversations) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "conversation-item";
    button.type = "button";
    button.setAttribute(
      "aria-current",
      String(conversation.id === activeConversationId),
    );
    button.setAttribute("aria-label", conversation.title);

    const title = document.createElement("span");
    title.className = "conversation-title";
    title.textContent = conversation.title;

    const date = document.createElement("span");
    date.className = "conversation-date";
    date.textContent = formatConversationDate(conversation.updatedAt);

    button.append(title, date);
    button.addEventListener("click", () => selectConversation(conversation.id));
    item.append(button);
    conversationList.append(item);
  }
}

function addMessage(text, role, isError = false) {
  const article = document.createElement("article");
  article.className = `message message-${role}${isError ? " message-error" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "T" : "M";

  const content = document.createElement("div");
  content.className = "message-content";

  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = role === "user" ? "Tú" : "Asistente";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  content.append(author, paragraph);
  article.append(avatar, content);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function renderMessages(conversation) {
  messages.replaceChildren();

  if (!conversation || conversation.messages.length === 0) {
    addMessage(INITIAL_GREETING, "assistant");
    return;
  }

  for (const message of conversation.messages) {
    addMessage(message.text, message.role, message.isError);
  }
}

function updateComposerState() {
  sendButton.disabled =
    activeConversationId !== undefined &&
    pendingConversations.has(activeConversationId);

  if (activeConversationId && pendingConversations.has(activeConversationId)) {
    status.textContent = "Escribiendo…";
  } else {
    status.textContent = "";
  }
}

function selectConversation(id) {
  const selected = conversations.find((item) => item.id === id);
  if (!selected) {
    return;
  }

  activeConversationId = selected.id;
  conversationId = selected.conversationId ?? undefined;
  input.value = "";
  renderConversationList();
  renderMessages(selected);
  saveConversations();
  updateComposerState();
  input.focus();
}

function createConversation(firstMessage) {
  const newConversation = {
    id: crypto.randomUUID(),
    title:
      firstMessage.length > 48
        ? `${firstMessage.slice(0, 47).trimEnd()}…`
        : firstMessage,
    conversationId: null,
    messages: [],
    updatedAt: new Date().toISOString(),
  };

  conversations.unshift(newConversation);
  activeConversationId = newConversation.id;
  conversationId = undefined;
  sortAndLimitConversations();
  return newConversation;
}

function appendSavedMessage(conversation, text, role, isError = false) {
  conversation.messages.push({ role, text, isError });
  conversation.updatedAt = new Date().toISOString();
  sortAndLimitConversations();
  saveConversations();
  renderConversationList();

  if (activeConversationId === conversation.id) {
    renderMessages(conversation);
  }
}

const loaded = loadConversations();
conversations = loaded.items;
activeConversationId =
  loaded.activeId !== undefined
    ? (loaded.activeId ?? undefined)
    : (conversations[0]?.id ?? undefined);
conversationId = currentConversation()?.conversationId ?? undefined;
renderConversationList();
renderMessages(currentConversation());

newChatButton.addEventListener("click", () => {
  activeConversationId = null;
  conversationId = undefined;
  input.value = "";
  renderConversationList();
  renderMessages(undefined);
  saveConversations();
  updateComposerState();
  status.textContent = "Conversación nueva lista.";
  input.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();

  if (!message || sendButton.disabled) {
    return;
  }

  let selected = currentConversation();
  if (!selected) {
    selected = createConversation(message);
  }

  const requestConversationId = selected.id;
  const foundryConversationId = selected.conversationId;
  appendSavedMessage(selected, message, "user");
  input.value = "";
  pendingConversations.add(requestConversationId);
  updateComposerState();

  const payload = { message };
  if (foundryConversationId) {
    payload.conversation_id = foundryConversationId;
  }

  try {
    const result = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await result.json();

    if (!result.ok) {
      throw new Error(data.error || "No se pudo enviar el mensaje.");
    }

    if (typeof data.response !== "string" || !data.response.trim()) {
      throw new Error("El asistente no devolvió una respuesta válida.");
    }

    if (typeof data.conversation_id === "string") {
      selected.conversationId = data.conversation_id;
      if (activeConversationId === selected.id) {
        conversationId = data.conversation_id;
      }
    }

    appendSavedMessage(selected, data.response, "assistant");
  } catch (error) {
    const errorMessage =
      error instanceof TypeError
        ? "No se pudo conectar con el servidor. Inténtalo de nuevo."
        : error.message;
    appendSavedMessage(selected, errorMessage, "assistant", true);
  } finally {
    pendingConversations.delete(requestConversationId);
    if (activeConversationId === requestConversationId) {
      updateComposerState();
      input.focus();
    }
  }
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
